export type FoodArtOperatorAction = "regenerate" | "dismiss";

export function parseFoodArtOperatorAction(value: unknown): FoodArtOperatorAction | undefined {
  if (value === "regenerate" || value === "dismiss") return value;
  return undefined;
}

export function boundedFoodArtReviewLimit(value: string | null | undefined, fallback = 25): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, parsed));
}

export function isUuidLike(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
