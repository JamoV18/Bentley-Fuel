import type { DiningDataProvider } from "./diningProvider";
import { DineOnCampusHybridProvider } from "./dineOnCampusProvider";

let provider: DiningDataProvider = new DineOnCampusHybridProvider();
export function getDiningProvider(): DiningDataProvider { return provider; }
export function setDiningProvider(nextProvider: DiningDataProvider): void { provider = nextProvider; }
