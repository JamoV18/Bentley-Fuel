import type { NutritionFacts } from "./nutrition";

export type SocialPlanKind = "ordinary" | "social" | "late-night";
export type AlcoholForecast = "none" | "unsure" | "1-2" | "3-4" | "5-plus";
export type NightOutCategory = "beer" | "hard-seltzer" | "wine" | "spirits" | "cocktail" | "mixed-unknown" | "nonalcoholic" | "custom";
export type NutritionEstimateStatus = "verified" | "estimated" | "approximate";

export interface GoingOutSettings {
  ownerProfileId: string;
  enabled: boolean;
  showOnToday: boolean;
  dismissedTodayDate?: string;
  /** Optional recurring routine context. Sunday is 0 and Saturday is 6. */
  usualHigherDays?: number[];
  updatedAt: string;
}

export interface NightOutConsumption {
  id: string;
  name: string;
  category: NightOutCategory;
  quantity: number;
  brandOrType?: string;
  /** Links recap data to an already-counted direct drink log. */
  sourceHistoryEntryId?: string;
  /** Exact local timestamp when known. */
  consumedAt?: string;
  /** Calendar day used when the exact time is unknown. */
  approximateDate?: string;
  timeAccuracy: "exact" | "date-only";
  servingOunces?: number;
  abvPercent?: number;
  mixerCalories?: number;
  standardDrinks?: number;
  nutrition: NutritionFacts;
  estimateStatus: NutritionEstimateStatus;
  calculationMethod: "source-total" | "ethanol-plus-mixer" | "category-estimate";
}

export interface GoingOutEvent {
  id: string;
  ownerProfileId: string;
  eventDate: string;
  planKind: SocialPlanKind;
  alcoholForecast?: AlcoholForecast;
  occasion?: "dinner-out" | "social-gathering" | "late-night-food" | "other";
  expectedFoodNote?: string;
  status: "planned" | "recap-completed" | "recap-skipped";
  ignoredForRecommendations?: boolean;
  actualConsumption?: NightOutConsumption[];
  createdAt: string;
  updatedAt: string;
}

/** Small, bounded signal consumed by the existing recommendation scorer. */
export interface GoingOutRecommendationContext {
  eventId: string;
  planKind: Exclude<SocialPlanKind, "ordinary">;
  eventDate: string;
}
