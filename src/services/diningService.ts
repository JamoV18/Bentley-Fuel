import type { DiningDataProvider } from "./diningProvider";
import { DineOnCampusHybridProvider } from "./dineOnCampusProvider";
import { installDineOnCampusServerFetchHeaders } from "./dineOnCampusServerFetch";

installDineOnCampusServerFetchHeaders();

let provider: DiningDataProvider = new DineOnCampusHybridProvider();
export function getDiningProvider(): DiningDataProvider { return provider; }
export function setDiningProvider(nextProvider: DiningDataProvider): void { provider = nextProvider; }
