import { notFound } from "next/navigation";
import { getPhase6ExampleMeal } from "@/lib/phase6ExampleMeal";
import { getDiningProvider } from "@/services";
import MealBuilderClient from "./MealBuilderClient";

export default async function MealBuilderPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  const provider = getDiningProvider();
  const location = await provider.getLocation(locationId);
  if (!location) notFound();

  // Retained only as a graceful fallback when no local student profile exists yet.
  const fallbackBuild = await getPhase6ExampleMeal(provider, locationId);
  if (!fallbackBuild) notFound();

  const menuItems = await provider.getMenuItems({ locationId });
  const stations = await provider.getStations(locationId);
  const componentIds = [...new Set(menuItems.flatMap((item) => [
    ...(item.componentIds ?? []),
    ...(item.customization?.flatMap((step) => step.componentIds) ?? []),
  ]))];
  const components = await provider.getComponents(componentIds);

  return (
    <MealBuilderClient
      fallbackBuild={fallbackBuild}
      resources={{ location, menuItems, stations, components }}
      isDemo={provider.dataStatus === "mock"}
    />
  );
}
