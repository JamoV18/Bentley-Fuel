import type { University } from "@/types";
import { mockProvenance } from "./provenance";

export const BENTLEY_UNIVERSITY_ID = "univ-bentley";
export const university: University = {
  id: BENTLEY_UNIVERSITY_ID,
  name: "Bentley University",
  shortName: "Bentley",
  city: "Waltham",
  state: "MA",
  diningProvider: "Bentley Dining",
  provenance: mockProvenance(1, "University identity is known; dining content remains mock data."),
};
