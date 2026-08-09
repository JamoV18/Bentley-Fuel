export { BRITO_COMPONENT_IDS, britoComponents } from "./brito";
export { PANTRY_COMPONENT_IDS, pantryComponents } from "./pantry";

import { BRITO_COMPONENT_IDS, britoComponents } from "./brito";
import { PANTRY_COMPONENT_IDS, pantryComponents } from "./pantry";

export const COMPONENT_IDS = { ...PANTRY_COMPONENT_IDS, ...BRITO_COMPONENT_IDS };
export const components = [...pantryComponents, ...britoComponents];
