import { notFound } from "next/navigation";
import { normalizeBentleyMenuDate } from "@/lib/bentleyDiningDate";
import { getPhase6ExampleMeal } from "@/lib/phase6ExampleMeal";
import { getDiningProvider } from "@/services";
import ManualMealBuilderClient from "./ManualMealBuilderClient";
import MealBuilderClient from "./MealBuilderClient";

export default async function MealBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ mode?: string; add?: string; date?: string }>;
}) {
  const { locationId } = await params;
  const query = await searchParams;
  const provider = getDiningProvider();
  const location = await provider.getLocation(locationId);
  if (!location) notFound();

  const menuDate = locationId === "loc-921" ? normalizeBentleyMenuDate(query.date) : undefined;
  const menuItems = await provider.getMenuItems({ locationId, date: menuDate });
  const stations = await provider.getStations(locationId, menuDate);
  const componentIds = [...new Set(menuItems.flatMap((item) => [
    ...(item.componentIds ?? []),
    ...(item.customization?.flatMap((step) => step.componentIds) ?? []),
  ]))];
  const components = await provider.getComponents(componentIds);
  const resources = { location, menuItems, stations, components };
  const usesVerifiedMenu = menuItems.some((item) => item.provenance.dataStatus === "verified");
  const isDemo = provider.dataStatus === "mock" && !usesVerifiedMenu;

  if (query.mode === "manual") {
    const initialMenuItemId = query.add && menuItems.some((item) => item.id === query.add) ? query.add : undefined;
    return (
      <ManualMealBuilderClient
        locationId={locationId}
        initialMenuItemId={initialMenuItemId}
        resources={resources}
        isDemo={isDemo}
      />
    );
  }

  const fallbackBuild = await getPhase6ExampleMeal(provider, locationId, menuDate);
  if (!fallbackBuild) notFound();

  return <MealBuilderClient fallbackBuild={fallbackBuild} resources={resources} isDemo={isDemo} />;
}
