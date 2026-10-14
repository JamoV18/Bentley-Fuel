import type { NightOutCategory, NightOutConsumption } from "@/types";

const MILLILITERS_PER_FLUID_OUNCE = 29.5735;

export type DrinkServingUnit = "fl oz" | "mL";

export interface DrinkPreset {
  category: NightOutCategory;
  label: string;
  servingName: string;
  servingAmount: number;
  servingUnit: DrinkServingUnit;
  servingOunces: number;
  servingLabel: string;
  abvPercent: number;
  caloriesPerServing: number;
  estimateStatus: NightOutConsumption["estimateStatus"];
  selectable: boolean;
}

const fluidOuncePreset = (
  preset: Omit<DrinkPreset, "servingAmount" | "servingUnit" | "servingOunces" | "servingLabel"> & { servingAmount: number; servingLabel?: string },
): DrinkPreset => ({
  ...preset,
  servingUnit: "fl oz",
  servingOunces: preset.servingAmount,
  servingLabel: preset.servingLabel ?? `${preset.servingAmount} fl oz`,
});

const milliliterPreset = (
  preset: Omit<DrinkPreset, "servingAmount" | "servingUnit" | "servingOunces" | "servingLabel"> & { servingAmount: number; servingLabel?: string },
): DrinkPreset => ({
  ...preset,
  servingUnit: "mL",
  servingOunces: preset.servingAmount / MILLILITERS_PER_FLUID_OUNCE,
  servingLabel: preset.servingLabel ?? `${preset.servingAmount} mL`,
});

const ALL_DRINK_PRESETS: readonly DrinkPreset[] = [
  fluidOuncePreset({ category: "wine", label: "Glass of wine", servingName: "glass", servingAmount: 5, abvPercent: 12, caloriesPerServing: 125, estimateStatus: "approximate", selectable: true }),
  milliliterPreset({ category: "wine-bottle", label: "Bottle of wine", servingName: "bottle", servingAmount: 750, abvPercent: 12, caloriesPerServing: 625, estimateStatus: "approximate", selectable: true }),
  fluidOuncePreset({ category: "beer", label: "Beer", servingName: "bottle or can", servingAmount: 12, abvPercent: 5, caloriesPerServing: 150, estimateStatus: "approximate", selectable: true }),
  fluidOuncePreset({ category: "hard-seltzer", label: "Hard seltzer", servingName: "can", servingAmount: 12, abvPercent: 5, caloriesPerServing: 100, estimateStatus: "approximate", selectable: true }),
  fluidOuncePreset({ category: "spirits", label: "Shot", servingName: "shot", servingAmount: 1.5, abvPercent: 40, caloriesPerServing: 100, estimateStatus: "approximate", selectable: true }),
  fluidOuncePreset({ category: "cocktail", label: "Cocktail", servingName: "typical serving", servingAmount: 6, servingLabel: "Typical serving", abvPercent: 15, caloriesPerServing: 200, estimateStatus: "approximate", selectable: true }),
  fluidOuncePreset({ category: "nonalcoholic", label: "Nonalcoholic drink", servingName: "drink", servingAmount: 12, abvPercent: 0, caloriesPerServing: 100, estimateStatus: "approximate", selectable: true }),
  fluidOuncePreset({ category: "mixed-unknown", label: "Mixed / unknown drink", servingName: "drink", servingAmount: 8, abvPercent: 12, caloriesPerServing: 180, estimateStatus: "approximate", selectable: false }),
  fluidOuncePreset({ category: "custom", label: "Custom drink", servingName: "serving", servingAmount: 12, abvPercent: 0, caloriesPerServing: 0, estimateStatus: "approximate", selectable: false }),
] as const;

export const DIRECT_DRINK_PRESETS = ALL_DRINK_PRESETS.filter((preset) => preset.selectable);

export function drinkPresetFor(category: NightOutCategory): DrinkPreset {
  return ALL_DRINK_PRESETS.find((preset) => preset.category === category) ?? ALL_DRINK_PRESETS[ALL_DRINK_PRESETS.length - 1];
}

export function servingAmountToOunces(preset: DrinkPreset, amount: number): number {
  return preset.servingUnit === "mL" ? amount / MILLILITERS_PER_FLUID_OUNCE : amount;
}

export function servingOuncesToAmount(preset: DrinkPreset, ounces: number): number {
  return preset.servingUnit === "mL" ? ounces * MILLILITERS_PER_FLUID_OUNCE : ounces;
}

export function estimatedDrinkCaloriesPerServing(category: NightOutCategory, servingOunces: number): number {
  const preset = drinkPresetFor(category);
  if (!Number.isFinite(servingOunces) || servingOunces <= 0 || preset.servingOunces <= 0) return 0;
  return Math.round((preset.caloriesPerServing * servingOunces / preset.servingOunces) * 10) / 10;
}

export function formattedDrinkServing(category: NightOutCategory, servingOunces?: number): string {
  const preset = drinkPresetFor(category);
  if (servingOunces === undefined || Math.abs(servingOunces - preset.servingOunces) < 0.01) return preset.servingLabel;
  const amount = servingOuncesToAmount(preset, servingOunces);
  const rounded = Math.round(amount * 10) / 10;
  return `${rounded} ${preset.servingUnit}`;
}
