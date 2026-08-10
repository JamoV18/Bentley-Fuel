import { BRITO_COMPONENT_IDS, britoComponents } from "./brito";
import { PANTRY_COMPONENT_IDS, pantryComponents } from "./pantry";

export * from "./brito";
export * from "./pantry";

/** Every mock component ID, exposed through one collision-free namespace. */
export const COMPONENT_IDS = {
  ...PANTRY_COMPONENT_IDS,
  ...BRITO_COMPONENT_IDS,
} as const;

/** Complete component collection consumed by the mock dataset. */
export const components = [...pantryComponents, ...britoComponents];
