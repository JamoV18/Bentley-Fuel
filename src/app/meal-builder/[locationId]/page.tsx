import { notFound } from "next/navigation";
import { getPhase6ExampleMeal } from "@/lib/phase6ExampleMeal";
import { getDiningProvider } from "@/services";
import ManualMealBuilderClient from "./ManualMealBuilderClient";
import MealBuilderClient from "./MealBuilderClient";

export default async function MealBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ mode?: string; add?: string }>;
}) {
  const { locationId } = await params;
  const query = await searchParams;
  const provider = getDiningProvider();
  const location = await provider.getLocation(locationId);
  if (!location) notFound();

  const menuItems = await provider.getMenuItems({ locationId });
  const stations = await provider.getStations(locationId);
  const componentIds = [...new Set(menuItems.flatMap((item) => [
    ...(item.componentIds ?? []),
    ...(item.customization?.flatMap((step) => step.componentIds) ?? []),
  ]))];
  const components = await provider.getComponents(componentIds);
  const resources = { location, menuItems, stations, components };

  if (query.mode === "manual") {
    const initialMenuItemId = query.add && menuItems.some((item) => item.id === query.add) ? query.add : undefined;
    return (
      <ManualMealBuilderClient
        locationId={locationId}
        initialMenuItemId={initialMenuItemId}
        resources={resources}
        isDemo={provider.dataStatus === "mock"}
      />
    );
  }

  // Retained only as a graceful fallback when no local student profile exists yet.
  const fallbackBuild = await getPhase6ExampleMeal(provider, locationId);
  if (!fallbackBuild) notFound();

  return (
    <MealBuilderClient
      fallbackBuild={fallbackBuild}
      resources={resources}
      isDemo={provider.dataStatus === "mock"}
    />
  );
}
