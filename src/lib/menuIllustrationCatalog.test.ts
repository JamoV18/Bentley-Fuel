import test from "node:test";
import assert from "node:assert/strict";
import { hasFoodIllustration } from "./foodIllustrations";
import {
  VERIFIED_LUNCH_MENU_ITEMS,
  hasExactMenuVisual,
  menuServingVesselForName,
  menuVisualForName,
} from "./menuIllustrationCatalog";
import { illustratedMealParts } from "./mealIllustrationComposition";

test("every verified lunch item name resolves to a deliberate illustration", () => {
  assert.ok(VERIFIED_LUNCH_MENU_ITEMS.length > 120);
  for (const name of VERIFIED_LUNCH_MENU_ITEMS) {
    assert.equal(
      hasFoodIllustration(name) || hasExactMenuVisual(name),
      true,
      `missing deliberate lunch illustration: ${name}`,
    );
  }
});

test("live dinner names infer serving-aware drawings instead of photo fallbacks", () => {
  assert.equal(menuVisualForName("Herb Grilled Salmon").kind, "protein-plate");
  assert.equal(menuServingVesselForName("Herb Grilled Salmon"), "plate");
  assert.equal(menuVisualForName("Tomato Basil Soup").kind, "soup");
  assert.equal(menuServingVesselForName("Tomato Basil Soup"), "bowl");
  assert.equal(menuVisualForName("Pepperoni Pizza").kind, "pizza");
});

test("complete live meals can compose even when a dinner item is new", () => {
  assert.deepEqual(
    illustratedMealParts("Herb Grilled Salmon + Roasted Broccoli + Brown Rice"),
    ["Herb Grilled Salmon", "Roasted Broccoli", "Brown Rice"],
  );
});
