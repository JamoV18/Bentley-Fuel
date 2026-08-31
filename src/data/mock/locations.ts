import type { Location } from "@/types";
import { BENTLEY_UNIVERSITY_ID } from "./university";
import { buildHours, weekdays, weekend } from "./hours";
import { mockProvenance } from "./provenance";

/** Stable location IDs — referenced by stations, items, and user profiles. */
export const LOCATION_IDS = {
  nineTwentyOne: "loc-921",
  harrys: "loc-harrys",
  dunkin: "loc-dunkin",
  laCava: "loc-lacava",
  dana: "loc-dana",
  einstein: "loc-einstein",
  market: "loc-market",
} as const;

export type KnownLocationId = (typeof LOCATION_IDS)[keyof typeof LOCATION_IDS];

export const locations: Location[] = [
  {
    id: LOCATION_IDS.nineTwentyOne,
    name: "921 Dining",
    shortName: "921",
    type: "dining-hall",
    universityId: BENTLEY_UNIVERSITY_ID,
    building: "921 Residential Dining",
    description:
      "Bentley's all-you-care-to-eat residential dining hall with rotating stations for grill, home-style entrées, global flavors, salads, and allergen-friendly options.",
    geo: { lat: 42.3889, lng: -71.2201 },
    mealPlanAccepted: true,
    acceptsDiningDollars: true,
    hours: buildHours({
      ...weekdays(
        { open: "07:00", close: "10:30", period: "breakfast" },
        { open: "11:00", close: "14:30", period: "lunch" },
        { open: "17:00", close: "21:00", period: "dinner" },
      ),
      ...weekend(
        { open: "09:00", close: "14:00", period: "brunch" },
        { open: "17:00", close: "20:00", period: "dinner" },
      ),
    }),
    provenance: mockProvenance(0.5, "Location exists; hours are illustrative mock values."),
  },
  {
    id: LOCATION_IDS.harrys,
    name: "Harry's Pub",
    shortName: "Harry's",
    type: "quick-service",
    universityId: BENTLEY_UNIVERSITY_ID,
    building: "Student Center",
    description: "Student Center pub and quick-service dining outlet.",
    provenance: mockProvenance(0.9, "Location and building are confirmed by Bentley DineOnCampus; hours are not modeled here."),
  },
  {
    id: LOCATION_IDS.dunkin,
    name: "Dunkin'",
    shortName: "Dunkin'",
    type: "cafe",
    universityId: BENTLEY_UNIVERSITY_ID,
    building: "Student Center",
    description: "Dunkin' in the Student Center.",
    provenance: mockProvenance(0.9, "Location and building are confirmed by Bentley DineOnCampus; hours are not modeled here."),
  },
  {
    id: LOCATION_IDS.laCava,
    name: "LaCava Center",
    shortName: "LaCava",
    type: "food-court",
    universityId: BENTLEY_UNIVERSITY_ID,
    building: "LaCava Campus Center",
    description:
      "Retail food court in the campus center with a grill, deli, and coffee counter — quick à la carte meals between classes.",
    geo: { lat: 42.3882, lng: -71.2215 },
    mealPlanAccepted: false,
    acceptsDiningDollars: true,
    hours: buildHours({
      ...weekdays(
        { open: "07:30", close: "20:00", period: "all-day" },
      ),
      ...weekend({ open: "10:00", close: "16:00", period: "all-day" }),
    }),
    provenance: mockProvenance(0.5, "Location exists; hours are illustrative mock values."),
  },
  {
    id: LOCATION_IDS.dana,
    name: "Dana Center",
    shortName: "Dana Center",
    type: "food-court",
    universityId: BENTLEY_UNIVERSITY_ID,
    building: "Dana Center",
    description:
      "Home to Blue Chip and the morning-only Nest dining concepts.",
    provenance: mockProvenance(0.8, "Campus structure is confirmed; operational details are not included."),
  },
  {
    id: LOCATION_IDS.einstein,
    name: "Einstein Bros. Bagels",
    shortName: "Einstein Bros.",
    type: "cafe",
    universityId: BENTLEY_UNIVERSITY_ID,
    building: "Bentley Library",
    description: "Einstein Bros. Bagels in the Bentley Library.",
    provenance: mockProvenance(0.9, "Location and building are confirmed by Bentley DineOnCampus; hours are not modeled here."),
  },
  {
    id: LOCATION_IDS.market,
    name: "Falcon Market",
    shortName: "Falcon Market",
    type: "market",
    universityId: BENTLEY_UNIVERSITY_ID,
    building: "Collins",
    description:
      "Convenience market for grab-and-go meals, snacks, protein drinks, and packaged staples — open late.",
    geo: { lat: 42.3891, lng: -71.2208 },
    mealPlanAccepted: false,
    acceptsDiningDollars: true,
    hours: buildHours({
      ...weekdays(
        { open: "08:00", close: "23:59", period: "all-day" },
        { open: "00:00", close: "01:00", period: "late-night" },
      ),
      ...weekend(
        { open: "10:00", close: "23:59", period: "all-day" },
        { open: "00:00", close: "01:00", period: "late-night" },
      ),
    }),
    provenance: mockProvenance(0.5, "Location exists; hours are illustrative mock values."),
  },
];