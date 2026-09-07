import { readFoodArtConfig, type FoodArtConfig } from "./config";
import type { FoodArtApiUsage, FoodArtItemRecord } from "./types";

const GENERATION_ATTEMPTS = 3;

export type FoodArtPromptSource = Pick<
  FoodArtItemRecord,
  "display_name" | "description" | "ingredients" | "serving_description"
>;

function sourceLine(label: string, value: string | null): string {
  return value?.trim() ? `${label}: ${value.trim()}` : `${label}: not published by the dining source`;
}

export function buildFalconFoodArtPrompt(item: FoodArtPromptSource): string {
  return [
    "Create one finished Falcon Fuel food illustration for use directly as a production app asset.",
    "",
    "ART DIRECTION:",
    "- premium, highly detailed 2D digital food illustration; polished editorial/cartoon food art, not a primitive icon",
    "- clean confident dark-navy contour linework with nuanced interior linework",
    "- appetizing natural colors, subtle dimensional shading, highlights, browning, texture, crumbs, seeds, folds, sauce sheen, vegetable structure, and ingredient layering where physically appropriate",
    "- the food must be instantly recognizable without reading its name",
    "- show the real finished dish as it would actually be served and eaten; if this is a sandwich, pizza, omelet, wrap, composed entree, pastry, soup, or other prepared dish, draw that unified finished food rather than disconnected ingredient symbols",
    "- transparent background; no rectangular backdrop; no text; no labels; no captions",
    "- no logos, brand marks, branded packaging, or copied trade dress; for branded foods draw only the edible food itself unless an approved brand asset is supplied separately",
    "- no decorative garnish and absolutely no ingredient that is not supported by the source information below",
    "- centered composition, generous useful scale, nothing clipped, clean transparent edges",
    "- satisfyingly crisp at large mobile/desktop hero size; avoid blur, painterly haze, low-detail clip-art, emoji, sticker, block, or pictogram aesthetics",
    "- visual quality should feel like a skilled illustrator drew directly onto the Falcon Fuel screen",
    "",
    `FOOD NAME: ${item.display_name}`,
    sourceLine("DESCRIPTION", item.description),
    sourceLine("INGREDIENTS", item.ingredients),
    sourceLine("SERVING", item.serving_description),
    "",
    "SOURCE-TRUTH RULE: When source details are incomplete, represent only what the food name itself safely establishes. Do not guess hidden fillings, toppings, garnishes, sides, sauces, or fresh produce.",
  ].join("\n");
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function normalizeUsage(value: unknown): FoodArtApiUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const usage: FoodArtApiUsage = {};
  if (typeof raw.input_tokens === "number") usage.input_tokens = raw.input_tokens;
  if (typeof raw.output_tokens === "number") usage.output_tokens = raw.output_tokens;
  if (typeof raw.total_tokens === "number") usage.total_tokens = raw.total_tokens;
  if (raw.input_tokens_details && typeof raw.input_tokens_details === "object") {
    usage.input_tokens_details = raw.input_tokens_details as Record<string, unknown>;
  }
  if (raw.output_tokens_details && typeof raw.output_tokens_details === "object") {
    usage.output_tokens_details = raw.output_tokens_details as Record<string, unknown>;
  }
  return Object.keys(usage).length > 0 ? usage : null;
}

export async function generateFalconFoodArt(
  item: FoodArtPromptSource,
  config: FoodArtConfig = readFoodArtConfig(),
): Promise<{ bytes: Uint8Array; prompt: string; model: string; usage: FoodArtApiUsage | null }> {
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is required to generate Falcon Food Art.");
  const prompt = buildFalconFoodArtPrompt(item);

  for (let attempt = 1; attempt <= GENERATION_ATTEMPTS; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.imageModel,
        prompt,
        size: config.imageSize,
        quality: "high",
        background: "transparent",
        output_format: "png",
        n: 1,
      }),
    });

    if (response.ok) {
      const payload = await response.json() as {
        data?: Array<{ b64_json?: string }>;
        usage?: unknown;
      };
      const encoded = payload.data?.[0]?.b64_json;
      if (!encoded) throw new Error("Image generation succeeded but returned no PNG bytes.");
      return {
        bytes: new Uint8Array(Buffer.from(encoded, "base64")),
        prompt,
        model: config.imageModel,
        usage: normalizeUsage(payload.usage),
      };
    }

    const detail = (await response.text()).slice(0, 2000);
    if (!shouldRetry(response.status) || attempt === GENERATION_ATTEMPTS) {
      throw new Error(`Image generation failed (${response.status}): ${detail || response.statusText}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
  }

  throw new Error("Image generation exhausted all attempts.");
}
