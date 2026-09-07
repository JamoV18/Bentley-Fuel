import { describe, expect, it } from "vitest";
import { prerenderedFoodArtForName } from "@/lib/prerenderedFoodArt";

describe("prerenderedFoodArtForName", () => {
  it("uses approved generated art for exact known foods", () => {
    expect(prerenderedFoodArtForName("Barbeque Chicken")).toBe("/food-art/bbq-chicken.svg");
    expect(prerenderedFoodArtForName("Blonde Brownies")).toBe("/food-art/blonde-brownies.svg");
  });

  it("uses a chicken fallback only for chicken proteins", () => {
    expect(prerenderedFoodArtForName("Grilled Chicken Breast")).toBe("/food-art/protein-portion.svg");
    expect(prerenderedFoodArtForName("Grilled Salmon")).toBeNull();
  });

  it("does not turn every dessert into a brownie", () => {
    expect(prerenderedFoodArtForName("Chocolate Brownie")).toBe("/food-art/dessert-fallback.svg");
    expect(prerenderedFoodArtForName("Chocolate Chip Cookie")).toBeNull();
  });
});
