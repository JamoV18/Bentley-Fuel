import { readFoodArtConfig, type FoodArtConfig } from "./config";
import type { FoodArtPromptSource } from "./generator";
import type { FoodArtApiUsage, FoodArtQaResult } from "./types";

export const FOOD_ART_QA_THRESHOLDS = {
  identity: 80,
  sourceFidelity: 90,
  detail: 78,
  polish: 78,
  composition: 75,
} as const;

const QA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "pass",
    "identity_score",
    "source_fidelity_score",
    "detail_score",
    "polish_score",
    "composition_score",
    "text_or_logo_detected",
    "detected_food",
    "unsupported_elements",
    "issues",
    "summary",
  ],
  properties: {
    pass: { type: "boolean" },
    identity_score: { type: "number", minimum: 0, maximum: 100 },
    source_fidelity_score: { type: "number", minimum: 0, maximum: 100 },
    detail_score: { type: "number", minimum: 0, maximum: 100 },
    polish_score: { type: "number", minimum: 0, maximum: 100 },
    composition_score: { type: "number", minimum: 0, maximum: 100 },
    text_or_logo_detected: { type: "boolean" },
    detected_food: { type: "string" },
    unsupported_elements: { type: "array", items: { type: "string" } },
    issues: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
} as const;

function sourceLine(label: string, value: string | null): string {
  return value?.trim() ? `${label}: ${value.trim()}` : `${label}: not published`;
}

export function buildFoodArtQaPrompt(source: FoodArtPromptSource): string {
  return [
    "You are the production art director and source-fidelity reviewer for Falcon Fuel.",
    "Review the attached generated food illustration against the dining source below. Be strict: a failed candidate is regenerated, so do not excuse obvious visual or factual problems.",
    "",
    "SOURCE TRUTH",
    `Food name: ${source.display_name}`,
    sourceLine("Description", source.description),
    sourceLine("Ingredients", source.ingredients),
    sourceLine("Serving", source.serving_description),
    "",
    "REVIEW RULES",
    "- Identity: the food should be recognizable without reading its name and should visually match the named food.",
    "- Source fidelity: every visible ingredient, topping, garnish, sauce, side, filling, or preparation detail must be supported by the source. When source information is sparse, conservative depiction is correct; invented decoration is a failure.",
    "- Prepared-food composition: sandwiches, wraps, omelets, pizzas, salads, soups, pasta dishes, pastries, and composed entrees should look like coherent finished foods, not disconnected ingredient stickers or primitive blocks.",
    "- Detail: reject low-detail clip-art, emoji, generic geometric chunks, crude pictograms, or food that cannot be identified without its label.",
    "- Polish: require clean professional linework, appetizing texture and dimensional cues, intentional shapes, and hero-size production quality while remaining a 2D illustration.",
    "- Composition: the full serving should be comfortably visible, centered, not clipped, and presented in an appropriate vessel when one is established by the food itself.",
    "- Reject any visible words, labels, logos, brand marks, branded packaging, or copied trade dress.",
    "- Do not penalize absence of unsupported garnish. Do penalize unsupported visible food elements.",
    "- PNG dimensions and alpha transparency are validated separately in code; focus here on semantic and visual quality.",
    "",
    "Set pass=true only when this exact candidate is safe to publish directly in the Falcon Fuel app.",
  ].join("\n");
}

function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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

export function normalizeFoodArtQaResult(value: unknown): FoodArtQaResult {
  const raw = objectValue(value);
  return applyFoodArtQaPolicy({
    pass: raw.pass === true,
    identity_score: clampScore(raw.identity_score),
    source_fidelity_score: clampScore(raw.source_fidelity_score),
    detail_score: clampScore(raw.detail_score),
    polish_score: clampScore(raw.polish_score),
    composition_score: clampScore(raw.composition_score),
    text_or_logo_detected: raw.text_or_logo_detected === true,
    detected_food: stringValue(raw.detected_food),
    unsupported_elements: stringArray(raw.unsupported_elements),
    issues: stringArray(raw.issues),
    summary: stringValue(raw.summary),
  });
}

export function applyFoodArtQaPolicy(result: FoodArtQaResult): FoodArtQaResult {
  const passesPolicy = result.pass
    && result.identity_score >= FOOD_ART_QA_THRESHOLDS.identity
    && result.source_fidelity_score >= FOOD_ART_QA_THRESHOLDS.sourceFidelity
    && result.detail_score >= FOOD_ART_QA_THRESHOLDS.detail
    && result.polish_score >= FOOD_ART_QA_THRESHOLDS.polish
    && result.composition_score >= FOOD_ART_QA_THRESHOLDS.composition
    && !result.text_or_logo_detected
    && result.unsupported_elements.length === 0;
  return { ...result, pass: passesPolicy };
}

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: unknown;
};

function responseText(payload: ResponsesPayload): string | undefined {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.text?.trim()) return content.text.trim();
    }
  }
  return undefined;
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function reviewFalconFoodArt(
  source: FoodArtPromptSource,
  bytes: Uint8Array,
  config: FoodArtConfig = readFoodArtConfig(),
): Promise<{ result: FoodArtQaResult; usage: FoodArtApiUsage | null }> {
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is required to review Falcon Food Art.");
  const imageUrl = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  const prompt = buildFoodArtQaPrompt(source);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.qaModel,
        store: false,
        reasoning: { effort: "low" },
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "falcon_food_art_qa",
            strict: true,
            schema: QA_SCHEMA,
          },
        },
      }),
    });

    if (response.ok) {
      const payload = await response.json() as ResponsesPayload;
      const text = responseText(payload);
      if (!text) throw new Error("Food Art QA returned no structured review text.");
      try {
        return {
          result: normalizeFoodArtQaResult(JSON.parse(text)),
          usage: normalizeUsage(payload.usage),
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Food Art QA returned invalid JSON: ${detail}`);
      }
    }

    const detail = (await response.text()).slice(0, 2000);
    if (!shouldRetry(response.status) || attempt === 3) {
      throw new Error(`Food Art QA failed (${response.status}): ${detail || response.statusText}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
  }

  throw new Error("Food Art QA exhausted all attempts.");
}
