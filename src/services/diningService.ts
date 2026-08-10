import type { DiningDataProvider } from "./diningProvider";
import { MockDiningProvider } from "./mockDiningProvider";

let provider: DiningDataProvider = new MockDiningProvider();
export function getDiningProvider(): DiningDataProvider { return provider; }
export function setDiningProvider(nextProvider: DiningDataProvider): void { provider = nextProvider; }
