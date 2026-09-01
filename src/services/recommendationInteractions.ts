import type {
  MealBuild,
  MealCandidate,
  MealHistoryEntry,
  RecommendationInteraction,
  RecommendationInteractionItem,
} from "@/types";

export const RECOMMENDATION_INTERACTION_STORAGE_KEY = "bentley-fuel.recommendation-interactions.v1";
const REPLACEMENT_LINK_WINDOW_MS = 30 * 60 * 1000;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validIso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stableMenuItemId = (id: string) => id.replace(/-\d{4}-\d{2}-\d{2}-item-/, "-item-");
const round1 = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const validItem = (value: unknown): value is RecommendationInteractionItem => {
  if (!isRecord(value) || typeof value.menuItemId !== "string" || value.menuItemId.length === 0) return false;
  return (value.name === undefined || typeof value.name === "string") &&
    (value.stationId === undefined || typeof value.stationId === "string");
};

const validBuild = (value: unknown): value is MealBuild => {
  if (!isRecord(value) || typeof value.locationId !== "string" || !Array.isArray(value.items)) return false;
  return value.items.every((line) =>
    isRecord(line) && typeof line.id === "string" && typeof line.menuItemId === "string" &&
    typeof line.quantity === "number" && Number.isFinite(line.quantity) && line.quantity > 0,
  );
};

export const isValidRecommendationInteraction = (value: unknown): value is RecommendationInteraction => {
  if (!isRecord(value)) return false;
  const kinds = ["recommendation-viewed", "item-removed", "replacement-accepted", "meal-chosen"];
  if (typeof value.id !== "string" || value.id.length === 0 || !kinds.includes(String(value.kind))) return false;
  if (!validIso(value.occurredAt) || typeof value.locationId !== "string" || value.locationId.length === 0) return false;
  if (value.mealPeriod !== undefined && typeof value.mealPeriod !== "string") return false;
  if (value.build !== undefined && !validBuild(value.build)) return false;
  if (value.subject !== undefined && !validItem(value.subject)) return false;
  if (value.replacement !== undefined && !validItem(value.replacement)) return false;
  if (value.kind === "item-removed" && !validItem(value.subject)) return false;
  if (value.kind === "replacement-accepted" && (!validItem(value.subject) || !validItem(value.replacement))) return false;
  return true;
};

export interface RecommendationInteractionRepository {
  getRecent(limit?: number): RecommendationInteraction[];
  append(interaction: RecommendationInteraction): void;
  clear(): void;
}

export function createLocalRecommendationInteractionRepository(storage: StorageLike): RecommendationInteractionRepository {
  const read = (): RecommendationInteraction[] => {
    const raw = storage.getItem(RECOMMENDATION_INTERACTION_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(isValidRecommendationInteraction)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    } catch {
      return [];
    }
  };

  return {
    getRecent(limit = 60) {
      return read().slice(0, Math.max(0, Math.floor(limit)));
    },
    append(interaction) {
      if (!isValidRecommendationInteraction(interaction)) throw new Error("Refusing to store an invalid recommendation interaction");
      const next = [interaction, ...read().filter((row) => row.id !== interaction.id)]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      storage.setItem(RECOMMENDATION_INTERACTION_STORAGE_KEY, JSON.stringify(next));
    },
    clear() {
      storage.removeItem(RECOMMENDATION_INTERACTION_STORAGE_KEY);
    },
  };
}

export const browserRecommendationInteractionRepository = (): RecommendationInteractionRepository =>
  createLocalRecommendationInteractionRepository(window.localStorage);

const candidateMatchesItem = (candidate: MealCandidate, item: RecommendationInteractionItem): boolean => {
  const stable = stableMenuItemId(item.menuItemId);
  const name = item.name ? normalized(item.name) : "";
  return candidate.build.items.some((line) => {
    if (stableMenuItemId(line.menuItemId) === stable) return true;
    const lineName = line.display?.name ? normalized(line.display.name) : "";
    return Boolean(name && lineName && name === lineName);
  });
};

const sameBuildLine = (a: MealBuild["items"][number], b: MealBuild["items"][number]) =>
  stableMenuItemId(a.menuItemId) === stableMenuItemId(b.menuItemId) ||
  Boolean(a.display?.name && b.display?.name && normalized(a.display.name) === normalized(b.display.name));

/**
 * Meal history is the authoritative acceptance record. When a chosen meal is
 * preceded by one recent removal at the same location, compare the saved build
 * with the post-removal build. Exactly one newly added line is enough to record
 * a replacement-accepted event. Ambiguous edits are intentionally ignored.
 */
export function recordChosenMealInteractions(storage: StorageLike, entry: MealHistoryEntry): void {
  const repository = createLocalRecommendationInteractionRepository(storage);
  const chosenAt = Date.parse(entry.selectedAt);
  const recentRemoval = repository.getRecent(20).find((interaction) => {
    if (interaction.kind !== "item-removed" || !interaction.subject || !interaction.build) return false;
    if (interaction.locationId !== entry.locationId) return false;
    const removedAt = Date.parse(interaction.occurredAt);
    const elapsed = chosenAt - removedAt;
    return elapsed >= 0 && elapsed <= REPLACEMENT_LINK_WINDOW_MS;
  });

  if (recentRemoval?.subject && recentRemoval.build) {
    const added = entry.build.items.filter((line) =>
      !recentRemoval.build!.items.some((prior) => sameBuildLine(line, prior)),
    );
    if (added.length === 1) {
      const replacement = added[0];
      repository.append({
        id: `replacement-accepted:${entry.id}:${recentRemoval.id}`,
        kind: "replacement-accepted",
        occurredAt: entry.selectedAt,
        locationId: entry.locationId,
        subject: recentRemoval.subject,
        replacement: {
          menuItemId: replacement.menuItemId,
          name: replacement.display?.name,
          stationId: replacement.display?.stationId,
        },
      });
    }
  }

  repository.append({
    id: `meal-chosen:${entry.id}`,
    kind: "meal-chosen",
    occurredAt: entry.selectedAt,
    locationId: entry.locationId,
    build: entry.build,
  });
}

export interface RecommendationInteractionScore {
  /** Small positive evidence from deliberately accepting a replacement. */
  preferenceBoost: number;
  /** Repeated removals of the same item; one edit alone is never treated as an aversion. */
  aversionPenalty: number;
  evidenceCount: number;
  signals: string[];
}

/**
 * Editor events are intentionally weaker than explicit likes/dislikes and are
 * never hard filters. A recommendation view has zero ranking effect. One item
 * removal also has zero effect; repeated removals are required before a small
 * negative signal is allowed. Accepted replacements can contribute a small
 * positive signal because the student deliberately chose that substitute.
 */
export function scoreRecommendationInteractions(
  candidate: MealCandidate,
  interactions: readonly RecommendationInteraction[] = [],
): RecommendationInteractionScore {
  let replacementWeight = 0;
  let replacementCount = 0;
  let removalWeight = 0;
  let removalCount = 0;
  let replacementLabel: string | undefined;
  let removalLabel: string | undefined;

  interactions.slice(0, 60).forEach((interaction, index) => {
    const recency = 1 / (1 + index * 0.12);
    const locationWeight = interaction.locationId === candidate.build.locationId ? 1.1 : 0.7;
    const weight = recency * locationWeight;

    if (interaction.kind === "replacement-accepted" && interaction.replacement && candidateMatchesItem(candidate, interaction.replacement)) {
      replacementWeight += weight;
      replacementCount += 1;
      replacementLabel ??= interaction.replacement.name;
    }
    if (interaction.kind === "item-removed" && interaction.subject && candidateMatchesItem(candidate, interaction.subject)) {
      removalWeight += weight;
      removalCount += 1;
      removalLabel ??= interaction.subject.name;
    }
  });

  const preferenceBoost = replacementCount > 0 ? round1(clamp(replacementWeight * 0.75, 0, 2.2)) : 0;
  const aversionPenalty = removalCount >= 2 ? round1(clamp(removalWeight * 1.8, 0, 6)) : 0;
  const signals: string[] = [];
  if (preferenceBoost >= 0.4) signals.push(replacementLabel ? `accepted ${replacementLabel} as a replacement before` : "accepted a similar replacement before");
  if (aversionPenalty >= 1) signals.push(removalLabel ? `removed ${removalLabel} more than once` : "removed a similar item more than once");

  return {
    preferenceBoost,
    aversionPenalty,
    evidenceCount: replacementCount + (removalCount >= 2 ? removalCount : 0),
    signals,
  };
}
