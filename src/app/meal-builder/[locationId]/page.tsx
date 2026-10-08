import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import FlowHeader from "@/components/FlowHeader";
import { formatMenuDate, normalizeBentleyMenuDate } from "@/lib/bentleyDiningDate";
import { getPhase6ExampleMeal } from "@/lib/phase6ExampleMeal";
import { campusStapleDiningResources, canonicalPlanningDiningResources, getDiningProvider, recordsForExactMenuDate } from "@/services";
import { ADDITIONAL_LIVE_LOCATION_IDS } from "@/services/dineOnCampusLocationTargets";
import { installDineOnCampusServerFetchHeaders } from "@/services/dineOnCampusServerFetch";
import { normalizeStationMenuForMealBuilder } from "@/services/stationMenuNormalization";
import type { MealBuild, MealPeriod } from "@/types";
import ManualMealBuilderClient from "./ManualMealBuilderClient";
import MealBuilderClient from "./MealBuilderClient";

const PERIOD_ORDER: MealPeriod[] = ["breakfast", "brunch", "lunch", "dinner", "late-night"];
const readablePeriod = (period: MealPeriod) => period.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const periodMatches = (periods: readonly MealPeriod[] | undefined, period: MealPeriod) => !periods || periods.length === 0 || periods.includes("all-day") || periods.includes(period);
const asMealPeriod = (value: string | undefined): MealPeriod | undefined => PERIOD_ORDER.includes(value as MealPeriod) ? value as MealPeriod : undefined;

function currentBentleyMealPeriod(): MealPeriod {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date()));
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 22) return "dinner";
  return "late-night";
}

export default async function MealBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ mode?: string; manual?: string; add?: string; date?: string; period?: string; entryId?: string; planId?: string }>;
}) {
  const { locationId } = await params;
  const query = await searchParams;
  const isPlanning = query.mode === "plan";
  installDineOnCampusServerFetchHeaders();
  const provider = getDiningProvider();
  const location = await provider.getLocation(locationId);
  if (!location) notFound();

  const isNineTwentyOne = locationId === "loc-921";
  const isLiveMenuLocation = isNineTwentyOne || ADDITIONAL_LIVE_LOCATION_IDS.has(locationId);
  const menuDate = isLiveMenuLocation ? normalizeBentleyMenuDate(query.date) : undefined;
  const rawProviderMenuItems = await provider.getMenuItems({ locationId, date: menuDate });
  const rawProviderStations = await provider.getStations(locationId, menuDate);
  // The reliable provider intentionally serves the most recently published
  // snapshot when upstream dining is unavailable. That is correct for current
  // dining, but a future plan must never present that older snapshot as the
  // requested day's menu.
  const providerMenuItems = isPlanning && isLiveMenuLocation && menuDate
    ? recordsForExactMenuDate(rawProviderMenuItems, menuDate)
    : rawProviderMenuItems;
  const providerStations = isPlanning && isLiveMenuLocation && menuDate
    ? recordsForExactMenuDate(rawProviderStations, menuDate)
    : rawProviderStations;
  const usesVerifiedMenu = providerMenuItems.some((item) => item.provenance.dataStatus === "verified");
  const staples = campusStapleDiningResources(locationId);
  const canonical = isPlanning ? canonicalPlanningDiningResources(locationId) : { menuItems: [], stations: [] };
  const allMenuItems = [...providerMenuItems, ...staples.menuItems, ...canonical.menuItems];
  const allStations = [...providerStations, ...staples.stations, ...canonical.stations];

  if (isLiveMenuLocation && !usesVerifiedMenu && !isPlanning) {
    const requestedLabel = asMealPeriod(query.period);
    return (
      <main className="ff-page">
        <FlowHeader backHref={`/locations/${locationId}${menuDate ? `?date=${encodeURIComponent(menuDate)}` : ""}`} backLabel={location.shortName ?? location.name} />
        <section className="surface mt-8 p-6 sm:p-8">
          <p className="eyebrow">{location.shortName ?? location.name} live menu</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:text-5xl">Live menu unavailable</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed subtle">
            Falcon Fuel could not verify the DineOnCampus {requestedLabel ? `${readablePeriod(requestedLabel).toLowerCase()} ` : ""}menu for {menuDate ? formatMenuDate(menuDate) : "this date"}. No demo foods are being substituted.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="https://dineoncampus.com/bentley/whats-on-the-menu" target="_blank" rel="noreferrer" className="primary inline-flex items-center justify-center">Open Bentley DineOnCampus</a>
            <Link href={`/locations/${locationId}${menuDate ? `?date=${encodeURIComponent(menuDate)}` : ""}`} className="secondary inline-flex items-center justify-center">Try again</Link>
          </div>
          <p className="mt-5 text-xs subtle">A recommendation will only appear when this published menu is successfully verified.</p>
        </section>
      </main>
    );
  }

  const availablePeriods = PERIOD_ORDER.filter((period) => allMenuItems.some((item) => periodMatches(item.availability, period) && item.availability?.includes(period)));
  const requestedPeriod = asMealPeriod(query.period);
  const initialRawItem = query.add ? allMenuItems.find((item) => item.id === query.add) : undefined;
  const initialItemPeriod = initialRawItem?.availability?.find((period) => period !== "all-day" && PERIOD_ORDER.includes(period));

  let selectedPeriod = requestedPeriod && (availablePeriods.includes(requestedPeriod) || isPlanning) ? requestedPeriod : undefined;
  if (!selectedPeriod && initialItemPeriod && availablePeriods.includes(initialItemPeriod)) selectedPeriod = initialItemPeriod;
  if (!selectedPeriod && isLiveMenuLocation && availablePeriods.length > 0) {
    const clockPeriod = currentBentleyMealPeriod();
    selectedPeriod = availablePeriods.includes(clockPeriod) ? clockPeriod : availablePeriods[0];
  }

  if (isLiveMenuLocation && menuDate && selectedPeriod && !requestedPeriod) {
    const next = new URLSearchParams();
    if (query.mode) next.set("mode", query.mode);
    if (query.add) next.set("add", query.add);
    if (query.entryId) next.set("entryId", query.entryId);
    if (query.planId) next.set("planId", query.planId);
    if (query.manual) next.set("manual", query.manual);
    next.set("date", menuDate);
    next.set("period", selectedPeriod);
    redirect(`/meal-builder/${locationId}?${next.toString()}`);
  }

  const selectedItems = selectedPeriod ? allMenuItems.filter((item) => periodMatches(item.availability, selectedPeriod)) : allMenuItems;
  const normalized = normalizeStationMenuForMealBuilder(selectedItems, allStations, selectedPeriod);
  const menuItems = selectedPeriod
    ? normalized.menuItems.map((item) => ({ ...item, availability: ["all-day"] as MealPeriod[] }))
    : normalized.menuItems;
  const usedStationIds = new Set(menuItems.map((item) => item.stationId));
  const stations = selectedPeriod
    ? allStations.filter((station) => usedStationIds.has(station.id)).map((station) => ({ ...station, mealPeriods: ["all-day"] as MealPeriod[] }))
    : allStations;

  const componentIds = [...new Set(menuItems.flatMap((item) => [
    ...(item.componentIds ?? []),
    ...(item.customization?.flatMap((step) => step.componentIds) ?? []),
  ]))];
  const providerComponents = await provider.getComponents(componentIds);
  const components = [...new Map([
    ...providerComponents,
    ...normalized.components,
  ].map((component) => [component.id, component] as const)).values()];
  const resources = { location, menuItems, stations, components };
  const isDemo = provider.dataStatus === "mock" && !usesVerifiedMenu && !isPlanning;

  const periodHref = (period: MealPeriod) => {
    const next = new URLSearchParams();
    if (query.mode) next.set("mode", query.mode);
    if (query.manual) next.set("manual", query.manual);
    if (query.entryId) next.set("entryId", query.entryId);
    if (query.planId) next.set("planId", query.planId);
    if (menuDate) next.set("date", menuDate);
    next.set("period", period);
    return `/meal-builder/${locationId}?${next.toString()}`;
  };

  let content: React.ReactNode;
  if (query.mode === "manual" || (isPlanning && query.manual === "1")) {
    const initialMenuItemId = query.add && menuItems.some((item) => item.id === query.add) ? query.add : undefined;
    content = (
      <ManualMealBuilderClient
        locationId={locationId}
        editEntryId={query.entryId}
        planId={query.planId}
        planningDate={isPlanning ? menuDate : undefined}
        initialMenuItemId={initialMenuItemId}
        resources={resources}
        isDemo={isDemo}
        menuDate={menuDate}
        selectedMealPeriod={selectedPeriod}
      />
    );
  } else {
    const rawFallbackBuild = await getPhase6ExampleMeal(provider, locationId, menuDate, selectedPeriod);
    const normalizedItemIds = new Set(menuItems.map((item) => item.id));
    const fallbackBuild = rawFallbackBuild?.items.every((line) => normalizedItemIds.has(line.menuItemId))
      ? rawFallbackBuild
      : (isLiveMenuLocation ? { locationId, items: [] } satisfies MealBuild : rawFallbackBuild);
    if (!fallbackBuild) notFound();
    content = (
      <MealBuilderClient
        fallbackBuild={fallbackBuild}
        resources={resources}
        isDemo={isDemo}
        menuDate={menuDate}
        selectedMealPeriod={selectedPeriod}
        planId={query.planId}
        planningDate={isPlanning ? menuDate : undefined}
        futureMenuAvailable={usesVerifiedMenu}
      />
    );
  }

  return (
    <>
      {isLiveMenuLocation && menuDate && (availablePeriods.length > 0 || (isPlanning && selectedPeriod)) && (
        <div className="mx-auto w-full max-w-6xl px-6 pt-6">
          <section className="surface-soft flex flex-wrap items-center justify-between gap-3 p-3.5" aria-label={`Choose ${location.shortName ?? location.name} meal period`}>
            <div>
              <p className="eyebrow">{location.shortName ?? location.name} · {formatMenuDate(menuDate)}</p>
              <p className="mt-1 text-sm font-bold text-[var(--ff-text-primary)]">Choose the menu Falcon Fuel should use</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(availablePeriods.length > 0 ? availablePeriods : selectedPeriod ? [selectedPeriod] : []).map((period) => (
                <Link
                  key={period}
                  href={periodHref(period)}
                  className={selectedPeriod === period ? "rounded-full bg-[var(--ff-accent)] px-4 py-2 text-sm font-bold text-white shadow-sm" : "rounded-full border border-[var(--ff-border)] bg-[var(--ff-surface-elevated)] px-4 py-2 text-sm font-bold text-[var(--ff-text-primary)] transition hover:border-[var(--ff-border)]"}
                  aria-current={selectedPeriod === period ? "page" : undefined}
                >
                  {readablePeriod(period)}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
      {content}
    </>
  );
}
