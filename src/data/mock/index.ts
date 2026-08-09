import type { DiningDataset } from "@/types";
import { components } from "./components";
import { locations } from "./locations";
import { menuItems } from "./menuItems";
import { stations } from "./stations";
import { bentleyUniversity } from "./university";

export const mockDiningDataset: DiningDataset = {
  university: bentleyUniversity,
  locations,
  stations,
  components,
  menuItems,
};
