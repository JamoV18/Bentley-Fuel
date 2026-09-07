import { canonicalFoodArtId, normalizeFoodArtText } from "@/lib/foodArtIdentity";
import { getDiningProvider } from "@/services/diningService";
import type { MenuItem } from "@/types";
import { foodArtSourceFingerprint } from "./fingerprint";
import { FoodArtRepository } from "./repository";
import type {
  FoodArtItemRecord,
  FoodArtObservationRecord,
  FoodArtSourceRecord,
  FoodArtSourceSnapshot,
  FoodArtSyncSummary,
} from "./types";

function richness(item: MenuItem): number {
  return (item.ingredients?.length ?? 0) * 4
    + (item.description?.length ?? 0) * 2
    + (item.serving?.description?.length ?? 0);
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

function latestDate(values: string[]): string {
  return [...values].sort().at(-1) ?? values[0];
}

function sourceKey(canonicalId: string, sourceFingerprint: string): string {
  return `${canonicalId}::${sourceFingerprint}`;
}

function snapshot(
  item: MenuItem,
  menuDate: string,
  observedAt: string,
  stationName?: string,
): FoodArtSourceSnapshot {
  return {
    canonicalId: canonicalFoodArtId(item.name),
    normalizedName: normalizeFoodArtText(item.name),
    displayName: item.name.trim(),
    description: item.description?.trim() || undefined,
    ingredients: item.ingredients?.trim() || undefined,
    servingDescription: item.serving?.description?.trim() || undefined,
    sourceFingerprint: foodArtSourceFingerprint(item),
    menuDate,
    locationId: item.locationId,
    stationId: item.stationId,
    stationName,
    providerItemId: item.id,
    observedAt,
  };
}

export async function syncFoodArtRegistry(
  dates: string[],
  repository = new FoodArtRepository(),
): Promise<FoodArtSyncSummary> {
  const provider = getDiningProvider();
  const locations = await provider.getLocations();
  const observedAt = new Date().toISOString();
  const snapshots: Array<{ source: FoodArtSourceSnapshot; item: MenuItem }> = [];
  let unavailableLocations = 0;

  for (const menuDate of dates) {
    for (const location of locations) {
      const [items, stations] = await Promise.all([
        provider.getMenuItems({ locationId: location.id, date: menuDate }),
        provider.getStations(location.id, menuDate),
      ]);
      if (items.length === 0) {
        unavailableLocations += 1;
        continue;
      }
      const stationNames = new Map(stations.map((station) => [station.id, station.name] as const));
      for (const item of items) {
        snapshots.push({ source: snapshot(item, menuDate, observedAt, stationNames.get(item.stationId)), item });
      }
    }
  }

  const grouped = new Map<string, Array<{ source: FoodArtSourceSnapshot; item: MenuItem }>>();
  const sourceVariants = new Map<string, Array<{ source: FoodArtSourceSnapshot; item: MenuItem }>>();
  for (const entry of snapshots) {
    const canonicalGroup = grouped.get(entry.source.canonicalId) ?? [];
    canonicalGroup.push(entry);
    grouped.set(entry.source.canonicalId, canonicalGroup);

    const key = sourceKey(entry.source.canonicalId, entry.source.sourceFingerprint);
    const variantGroup = sourceVariants.get(key) ?? [];
    variantGroup.push(entry);
    sourceVariants.set(key, variantGroup);
  }

  const canonicalIds = [...grouped.keys()];
  const [existing, existingAssets] = await Promise.all([
    repository.getItems(canonicalIds),
    repository.getAssets(canonicalIds),
  ]);
  const itemRows: FoodArtItemRecord[] = [];
  const sourceRows: FoodArtSourceRecord[] = [];
  const jobs: Array<{ canonical_id: string; source_fingerprint: string }> = [];
  const observations: FoodArtObservationRecord[] = snapshots.map(({ source }) => ({
    canonical_id: source.canonicalId,
    source_fingerprint: source.sourceFingerprint,
    menu_date: source.menuDate,
    location_id: source.locationId,
    station_id: source.stationId,
    station_name: source.stationName ?? null,
    provider_item_id: source.providerItemId,
    display_name: source.displayName,
    observed_at: source.observedAt,
  }));

  for (const [key, entries] of sourceVariants) {
    const latestMenuDate = latestDate(entries.map((entry) => entry.source.menuDate));
    const latestEntries = entries.filter((entry) => entry.source.menuDate === latestMenuDate);
    const representative = [...latestEntries].sort((a, b) => richness(b.item) - richness(a.item))[0].source;
    sourceRows.push({
      canonical_id: representative.canonicalId,
      source_fingerprint: representative.sourceFingerprint,
      normalized_name: representative.normalizedName,
      display_name: representative.displayName,
      description: representative.description ?? null,
      ingredients: representative.ingredients ?? null,
      serving_description: representative.servingDescription ?? null,
      last_menu_date: latestMenuDate,
      last_seen_at: observedAt,
      updated_at: observedAt,
    });
    if (!existingAssets.has(key)) {
      jobs.push({
        canonical_id: representative.canonicalId,
        source_fingerprint: representative.sourceFingerprint,
      });
    }
  }

  let newFoods = 0;
  let changedFoods = 0;
  let unchangedFoods = 0;

  for (const [canonicalId, entries] of grouped) {
    // The name-level pointer follows the newest DineOnCampus publication, but
    // every distinct recipe fingerprint above remains independently preserved
    // and generation-eligible. This prevents same-name recipes from collapsing.
    const latestMenuDate = latestDate(entries.map((entry) => entry.source.menuDate));
    const latestEntries = entries.filter((entry) => entry.source.menuDate === latestMenuDate);
    const representative = [...latestEntries].sort((a, b) => richness(b.item) - richness(a.item))[0].source;
    const previous = existing.get(canonicalId);
    const fingerprintChanged = Boolean(previous && previous.source_fingerprint !== representative.sourceFingerprint);
    const isNew = !previous;
    const currentAsset = existingAssets.get(sourceKey(canonicalId, representative.sourceFingerprint));

    if (isNew) newFoods += 1;
    else if (fingerprintChanged) changedFoods += 1;
    else unchangedFoods += 1;

    const nextStatus = currentAsset
      ? "ready"
      : fingerprintChanged
        ? "stale"
        : previous?.status === "generating"
          ? "generating"
          : "queued";

    itemRows.push({
      canonical_id: canonicalId,
      normalized_name: representative.normalizedName,
      display_name: representative.displayName,
      description: representative.description ?? null,
      ingredients: representative.ingredients ?? null,
      serving_description: representative.servingDescription ?? null,
      source_fingerprint: representative.sourceFingerprint,
      location_ids: unique([...(previous?.location_ids ?? []), ...entries.map((entry) => entry.source.locationId)]),
      station_names: unique([...(previous?.station_names ?? []), ...entries.map((entry) => entry.source.stationName)]),
      last_menu_date: latestMenuDate,
      last_seen_at: observedAt,
      status: nextStatus,
      current_asset_id: currentAsset?.id ?? (fingerprintChanged ? null : previous?.current_asset_id ?? null),
      created_at: previous?.created_at,
      updated_at: observedAt,
    });
  }

  // FK order matters: sources reference canonical items; observations/jobs and
  // assets reference exact sources.
  await repository.upsertItems(itemRows);
  await repository.upsertSources(sourceRows);
  await repository.upsertObservations(observations);
  const queuedJobs = await repository.enqueueJobs(jobs);

  return {
    dates,
    rowsSeen: snapshots.length,
    uniqueFoods: grouped.size,
    uniqueSourceVariants: sourceVariants.size,
    newFoods,
    changedFoods,
    unchangedFoods,
    queuedJobs,
    unavailableLocations,
  };
}
