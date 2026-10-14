import type { LocationId } from "./common";
import type { NutritionFacts } from "./nutrition";

export type BeverageCategory =
  | "water"
  | "coffee-tea"
  | "milk"
  | "smoothie"
  | "juice"
  | "soda"
  | "sweetened-coffee"
  | "other";

export type BeverageVerificationStatus =
  | "verified-available"
  | "catalog-confirmed"
  | "unverified"
  | "manual";

export interface BeverageCatalogItem {
  id: string;
  name: string;
  category: BeverageCategory;
  locationId?: LocationId;
  servingLabel: string;
  nutrition: NutritionFacts;
  dataSource: "bentley-dining" | "falcon-reference" | "manual";
  verificationStatus: BeverageVerificationStatus;
  verifiedAt?: string;
  available?: boolean;
}

/** Immutable beverage snapshot saved with a meal. */
export interface CampusBeverageSelection {
  id: string;
  catalogItemId?: string;
  name: string;
  category: BeverageCategory;
  quantity: number;
  servingLabel: string;
  nutrition: NutritionFacts;
  dataSource: BeverageCatalogItem["dataSource"];
  verificationStatus: BeverageVerificationStatus;
}
