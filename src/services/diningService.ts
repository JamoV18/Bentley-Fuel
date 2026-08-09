import type { DiningDataProvider } from "./diningProvider";
import { MockDiningProvider } from "./mockDiningProvider";

let provider: DiningDataProvider | undefined;

export function getDiningProvider(): DiningDataProvider {
  provider ??= new MockDiningProvider();
  return provider;
}

/** Injection seam for a future provider or isolated tests. */
export function setDiningProvider(nextProvider: DiningDataProvider): void {
  provider = nextProvider;
}
