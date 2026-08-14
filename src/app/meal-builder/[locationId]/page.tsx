import { notFound } from "next/navigation";
import { getPhase6ExampleMeal } from "@/lib/phase6ExampleMeal";
import { getDiningProvider } from "@/services";
import MealBuilderClient from "./MealBuilderClient";

export default async function MealBuilderPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  const provider = getDiningProvider();
  const location = await provider.getLocation(locationId);
  if (!location) notFound();
  const build = await getPhase6ExampleMeal(provider, locationId);
  if (!build) notFound();
  const menuItems = await provider.getMenuItems({ locationId });
  const stations = await provider.getStations(locationId);
  const componentIds = [...new Set(menuItems.flatMap((item) => item.customization?.flatMap((step) => step.componentIds) ?? []))];
  const components = await provider.getComponents(componentIds);
  return <MealBuilderClient initialBuild={build} resources={{ location, menuItems, stations, components }} isDemo={provider.dataStatus === "mock"} />;
}
