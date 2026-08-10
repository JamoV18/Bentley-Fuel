import type { DiningDataset } from "@/types";
import { components } from "./components";
import { locations } from "./locations";
import { britoItems } from "./menuItems/brito";
import { laCavaItems } from "./menuItems/lacava";
import { marketItems } from "./menuItems/market";
import { nine21Items } from "./menuItems/nine21";
import { stations } from "./stations";
import { university } from "./university";

export const mockDiningDataset: DiningDataset = {
  university, locations, stations,
  components,
  menuItems: [...nine21Items, ...laCavaItems, ...britoItems, ...marketItems],
};
