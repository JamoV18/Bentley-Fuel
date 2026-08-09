import type { University } from "@/types";
import { mockProvenance } from "./provenance";

export const BENTLEY_UNIVERSITY_ID = "univ-bentley";

export const bentleyUniversity: University = {
  id: BENTLEY_UNIVERSITY_ID,
  name: "Bentley University",
  shortName: "Bentley",
  city: "Waltham",
  state: "MA",
  diningProvider: "Bentley Dining (mock)",
  provenance: mockProvenance(0.8, "University identity is real; dining-provider label is mock."),
};
