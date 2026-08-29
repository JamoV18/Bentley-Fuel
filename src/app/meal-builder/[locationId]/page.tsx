import Link from "next/link";
import { notFound } from "next/navigation";
import FlowHeader from "@/components/FlowHeader";
import { bentleyMenuDate, formatMenuDate, normalizeBentleyMenuDate } from "@/lib/bentleyDiningDate";
import { getPhase6ExampleMeal } from "@/lib/phase6ExampleMeal";
import { getDiningProvider } from "@/services";
import { installDineOnCampusServerFetchHeaders } from "@/services/dineOnCampusServerFetch";
import type { MealPeriod } from "@/types";
import ManualMealBuilderClient from "./ManualMealBuilderClient";
import MealBuilderClient from "./MealBuilderClient";

const PERIOD_ORDER: MealPeriod[] = ["breakfast", "brunch", "lunch", "dinner", "late-night"];
const readablePeriod = (period: MealPeriod) => period.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const periodMatches = (periods: readonly MealPeriod[] | undefined, period: MealPeriod) => !periods || periods.length === 0 || periods.includes("all-day") || periods.includes(period);
const asMealPeriod = (value: string | undefined): MealPeriod | undefined => PERIOD_ORDER.includes(value as MealPeriod) ? value as MealPeriod : undefined;

export default async function MealBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ mode?: string; add?: string; date?: string; period?: string }>;
}) {
  const { locationId } = await params;
  const query = await searchParams;
  installDineOnCampusServerFetchHeaders();
  const provider = getDiningProvider();
  const location = await provider.getLocation(locationId);
  if (!location) notFound();

  const isNineTwentyOne = locationId === "loc-921";
  const menuDate = isNineTwentyOne ? normalizeBentleyMenuDate(query.date) : undefined;
  const allMenuItems = await provider.getMenuItems({ locationId, date: menuDate });
  const allStations = await provider.getStations(locationId, menuDate);
  const usesVerifiedMenu = allMenuItems.some((item) => item.provenance.dataStatus === "verified");

  // The 921 is live-data-only. Never substitute mock foods into a current or
  // future DineOnCampus recommendation if the upstream menu request fails.
  if (isNineTwentyOne && !usesVerifiedMenu) {
    const requestedLabel = asMealPeriod(query.period);
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
        <FlowHeader backHref={`/locations/${locationId}${menuDate ? `?date=${encodeURIComponent(menuDate)}` : ""}`} backLabel="The 921" />
        <section className="surface mt-8 p-6 sm:p-8">
          <p className="eyebrow">921 live menu</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Live menu unavailable</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed subtle">
            Bentley Fuel could not verify the DineOnCampus {requestedLabel ? `${readablePeriod(requestedLabel).toLowerCase()} ` : ""}menu for {menuDate ? formatMenuDate(menuDate) : "this date"}. No demo foods are being substituted.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://dineoncampus.com/Bentley/locations"
              target="_blank"
              rel="noreferrer"
              className="primary inline-flex items-center justify-center"
            >
              Open Bentley DineOnCampus
            </a>
            <Link href={`/locations/${locationId}${menuDate ? `?date=${encodeURIComponent(menuDate)}` : ""}`} className="secondary inline-flex items-center justify-center">
              Try again
            </Link>
          </div>
          <p className="mt-5 text-xs subtle">A recommendation will only appear when the published 921 menu is successfully verified.</p>
        </section>
      </main>
    );
  }

  const availablePeriods = PERIOD_ORDER.filter((period) => allMenuItems.some((item) => periodMatches(item.availability, period) && item.availability?.includes(period)));
  const requestedPeriod = asMealPeriod(query.period);
  const initialRawItem = query.add ? allMenuItems.find((item) => item.id === query.add) : undefined;
  const initialItemPeriod = initialRawItem?.availability?.find((period) => period !== "all-day" && PERIOD_ORDER.includes(period));

  let selectedPeriod = requestedPeriod && availablePeriods.includes(requestedPeriod) ? requestedPeriod : undefined;
  if (!selectedPeriod && initialItemPeriod && availablePeriods.includes(initialItemPeriod)) selectedPeriod = initialItemPeriod;
  if (!selectedPeriod && isNineTwentyOne && menuDate !== bentleyMenuDate()) selectedPeriod = availablePeriods[0];

  const selectedItems = selectedPeriod
    ? allMenuItems.filter((item) => periodMatches(item.availability, selectedPeriod))
    : allMenuItems;
  const menuItems = selectedPeriod
    ? selectedItems.map((item) => ({ ...item, availability: ["all-day"] as MealPeriod[] }))
    : selectedItems;
  const usedStationIds = new Set(menuItems.map((item) => item.stationId));
  const stations = selectedPeriod
    ? allStations.filter((station) => usedStationIds.has(station.id)).map((station) => ({ ...station, mealPeriods: ["all-day"] as MealPeriod[] }))
    : allStations;

  const componentIds = [...new Set(menuItems.flatMap((item) => [
    ...(item.componentIds ?? []),
    ...(item.customization?.flatMap((step) => step.componentIds) ?? []),
  ]))];
  const components = await provider.getComponents(componentIds);
  const resources = { location, menuItems, stations, components };
  const isDemo = provider.dataStatus === "mock" && !usesVerifiedMenu;

  const periodHref = (period: MealPeriod) => {
    const next = new URLSearchParams();
    if (query.mode === "manual") next.set("mode", "manual");
    if (menuDate) next.set("date", menuDate);
    next.set("period", period);
    return `/meal-builder/${locationId}?${next.toString()}`;
  };

  let content: React.ReactNode;
  if (query.mode === "manual") {
    const initialMenuItemId = query.add && menuItems.some((item) => item.id === query.add) ? query.add : undefined;
    content = (
      <ManualMealBuilderClient
        locationId={locationId}
        initialMenuItemId={initialMenuItemId}
        resources={resources}
        isDemo={isDemo}
      />
    );
  } else {
    const fallbackBuild = await getPhase6ExampleMeal(provider, locationId, menuDate, selectedPeriod);
    if (!fallbackBuild) notFound();
    content = <MealBuilderClient fallbackBuild={fallbackBuild} resources={resources} isDemo={isDemo} />;
  }

  return (
    <>
      {isNineTwentyOne && menuDate && availablePeriods.length > 0 && (
        <div className="mx-auto w-full max-w-6xl px-6 pt-6">
          <section className="surface-soft flex flex-wrap items-center justify-between gap-3 p-3.5" aria-label="Choose 921 meal period">
            <div>
              <p className="eyebrow">921 · {formatMenuDate(menuDate)}</p>
              <p className="mt-1 text-sm font-bold text-emerald-950">Choose the menu Bentley Fuel should use</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availablePeriods.map((period) => (
                <Link
                  key={period}
                  href={periodHref(period)}
                  className={selectedPeriod === period
                    ? "rounded-full bg-emerald-900 px-4 py-2 text-sm font-bold text-white shadow-sm"
                    : "rounded-full border border-emerald-900/15 bg-white px-4 py-2 text-sm font-bold text-emerald-950 transition hover:border-emerald-800/30"}
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
