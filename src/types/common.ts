/**
 * Common primitives shared across the Falcon Fuel domain model.
 *
 * Design rules enforced here:
 *  - Every entity carries a stable, opaque `id` (never a display name).
 *  - Every entity carries `Provenance` so the UI/engine can always answer
 *    "where did this number come from and how much do we trust it?"
 *  - While the app ships with `dataStatus: "mock"`, these shapes are designed to
 *    survive being swapped for real Bentley/Chartwells data with no UI changes.
 */

/** How trustworthy / "real" a piece of data is. */
export type DataStatus =
  | "mock" // fabricated for development; never present as fact
  | "estimated" // derived/approximated (e.g. USDA lookup, manual math)
  | "verified" // confirmed against an authoritative source
  | "user-provided"; // entered by the student themselves

/** Where a piece of data originated. */
export type DataSourceType =
  | "mock-generator"
  | "bentley-dining"
  | "chartwells"
  | "usda"
  | "manual-estimate"
  | "user";

export interface DataSource {
  type: DataSourceType;
  /** Human-readable label, e.g. "Bentley Dining (mock)". */
  name: string;
  /** Optional link back to the authoritative source when it exists. */
  url?: string;
  /** ISO-8601 timestamp of when the data was captured, if known. */
  retrievedAt?: string;
}

/**
 * Attached to every entity. The recommendation engine and UI must be able to
 * downgrade, flag, or hide low-confidence data without special-casing.
 */
export interface Provenance {
  dataStatus: DataStatus;
  source: DataSource;
  /** 0..1 subjective confidence in the accuracy of this record. */
  confidence: number;
  /** Free-form caveats, e.g. "portion size assumed", shown as a tooltip. */
  notes?: string;
}

/** Opaque, stable identifiers. Aliased for readability at call sites. */
export type UniversityId = string;
export type LocationId = string;
export type StationId = string;
export type MenuItemId = string;
export type FoodComponentId = string;
export type UserId = string;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** Named eating windows used for menu availability and recommendations. */
export type MealPeriod =
  | "breakfast"
  | "brunch"
  | "lunch"
  | "dinner"
  | "late-night"
  | "all-day";

/** A single open/close window within a day. Times are 24h "HH:mm" local. */
export interface HoursWindow {
  open: string;
  close: string;
  /** Optional meal label this window corresponds to. */
  period?: MealPeriod;
}

export interface DailyHours {
  day: DayOfWeek;
  /** Empty array = closed that day. */
  windows: HoursWindow[];
}

/** A serving/portion descriptor for nutrition math and UI display. */
export interface ServingSize {
  amount: number;
  /** Unit of `amount`, e.g. "g", "oz", "cup", "each", "scoop". */
  unit: string;
  /** Human-friendly description, e.g. "1 bowl (~350g)". */
  description?: string;
}
