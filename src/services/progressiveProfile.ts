import type {
  MealBuild,
  MealHistoryEntry,
  ProgressivePreferenceAnswer,
  ProgressivePreferenceKind,
  ProgressivePreferenceResponse,
} from "@/types";

export const PROGRESSIVE_PROFILE_STORAGE_KEY = "bentley-fuel.progressive-profile.v1";
export const PROGRESSIVE_PROFILE_LATER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProgressivePreferencePrompt {
  key: string;
  kind: ProgressivePreferenceKind;
  value: string;
  label: string;
  evidenceCount: number;
  direction: "favor" | "avoid";
  question: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Evidence = { weight: number; count: number };

type FamilyDefinition = {
  kind: ProgressivePreferenceKind;
  value: string;
  label: string;
  matcher: RegExp;
};

const FAMILIES: readonly FamilyDefinition[] = [
  { kind: "protein", value: "chicken", label: "chicken-based meals", matcher: /\b(chicken|chicken breast|chicken thigh)\b/ },
  { kind: "protein", value: "turkey", label: "turkey-based meals", matcher: /\b(turkey|turkey breast)\b/ },
  { kind: "protein", value: "beef", label: "beef-based meals", matcher: /\b(beef|steak|cheesesteak|brisket|meatball|hamburger|burger)\b/ },
  { kind: "protein", value: "pork", label: "pork-based meals", matcher: /\b(pork|ham|bacon|sausage|carnitas|al pastor)\b/ },
  { kind: "protein", value: "seafood", label: "seafood meals", matcher: /\b(salmon|tuna|fish|shrimp|cod|tilapia|mahi|seafood)\b/ },
  { kind: "protein", value: "eggs", label: "egg-based meals", matcher: /\b(egg|eggs|omelet|omelette|egg whites)\b/ },
  { kind: "protein", value: "plant-protein", label: "plant-protein meals", matcher: /\b(tofu|tempeh|seitan)\b/ },
  { kind: "protein", value: "legumes", label: "beans and legumes", matcher: /\b(beans|lentils|chickpeas|black beans|pinto beans|kidney beans)\b/ },
  { kind: "cuisine", value: "latin", label: "Latin-style meals", matcher: /\b(latin|mexican|burrito|taco|tacos|quesadilla|enchilada|fajita|salsa|carnitas|al pastor)\b/ },
  { kind: "cuisine", value: "italian", label: "Italian-style meals", matcher: /\b(italian|pizza|pasta|penne|marinara|lasagna|ravioli|parmesan|cucina)\b/ },
  { kind: "cuisine", value: "asian", label: "Asian-style meals", matcher: /\b(asian|teriyaki|katsu|stir fry|thai|korean|chinese|japanese|sushi|fried rice|noodle|ramen)\b/ },
  { kind: "cuisine", value: "mediterranean", label: "Mediterranean-style meals", matcher: /\b(mediterranean|hummus|falafel|gyro|tzatziki|shawarma)\b/ },
  { kind: "cuisine", value: "deli", label: "deli-style meals", matcher: /\b(deli|sandwich|panini|sub|hoagie|melt|cheesesteak)\b/ },
  { kind: "cuisine", value: "breakfast", label: "breakfast-style meals", matcher: /\b(breakfast|egg|omelet|omelette|pancake|waffle|oatmeal|cereal|french toast|bagel)\b/ },
  { kind: "cuisine", value: "salad", label: "salad-based meals", matcher: /\b(salad|greens|slaw)\b/ },
  { kind: "cuisine", value: "american", label: "American-style meals", matcher: /\b(american|burger|grill|bbq|barbecue|fries|mac and cheese|homestyle|comfort)\b/ },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validIso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const RESPONSES: ProgressivePreferenceResponse[] = ["favor", "avoid", "neutral", "later"];
const KINDS: ProgressivePreferenceKind[] = ["protein", "cuisine"];

export const isValidProgressivePreferenceAnswer = (value: unknown): value is ProgressivePreferenceAnswer => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 &&
    typeof value.key === "string" && value.key.length > 0 &&
    KINDS.includes(value.kind as ProgressivePreferenceKind) &&
    typeof value.value === "string" && value.value.length > 0 &&
    typeof value.label === "string" && value.label.length > 0 && value.label.length <= 120 &&
    RESPONSES.includes(value.response as ProgressivePreferenceResponse) &&
    typeof value.evidenceCount === "number" && Number.isInteger(value.evidenceCount) && value.evidenceCount >= 1 && value.evidenceCount <= 1000 &&
    validIso(value.answeredAt);
};

export interface ProgressiveProfileRepository {
  getRecent(limit?: number): ProgressivePreferenceAnswer[];
  upsert(answer: ProgressivePreferenceAnswer): void;
  clear(): void;
}

export function createLocalProgressiveProfileRepository(storage: StorageLike): ProgressiveProfileRepository {
  const read = (): ProgressivePreferenceAnswer[] => {
    const raw = storage.getItem(PROGRESSIVE_PROFILE_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidProgressivePreferenceAnswer).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
    } catch {
      return [];
    }
  };

  return {
    getRecent(limit = 50) {
      return read().slice(0, Math.max(0, Math.floor(limit)));
    },
    upsert(answer) {
      if (!isValidProgressivePreferenceAnswer(answer)) throw new Error("Refusing to store an invalid progressive preference answer");
      const next = [answer, ...read().filter((entry) => entry.id !== answer.id)]
        .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
      storage.setItem(PROGRESSIVE_PROFILE_STORAGE_KEY, JSON.stringify(next));
    },
    clear() {
      storage.removeItem(PROGRESSIVE_PROFILE_STORAGE_KEY);
    },
  };
}

export const browserProgressiveProfileRepository = (): ProgressiveProfileRepository =>
  createLocalProgressiveProfileRepository(window.localStorage);

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const buildText = (build: MealBuild): string => normalized(
  build.items.map((line) => line.display?.name ?? line.menuItemId).join(" "),
);

export function mealBuildMatchesProgressivePreference(
  build: MealBuild,
  kind: ProgressivePreferenceKind,
  value: string,
): boolean {
  const definition = FAMILIES.find((family) => family.kind === kind && family.value === value);
  return definition ? definition.matcher.test(buildText(build)) : false;
}

function positiveEvidenceWeight(entry: MealHistoryEntry): number {
  if (entry.explicitFeedback === "dislike" || entry.completionFraction === 0) return 0;
  if (entry.explicitFeedback === "like") return 1.6 + (entry.completionFraction ?? 0) * 0.4;
  if (entry.completionFraction !== undefined) {
    if (entry.completionFraction >= 0.8) return 1.1;
    if (entry.completionFraction >= 0.5) return 0.75;
    if (entry.completionFraction > 0) return 0.35;
  }
  return entry.source === "self-built" ? 0.3 : 0;
}

const keyFor = (kind: ProgressivePreferenceKind, value: string) => `${kind}:${value}`;

function blockedByAnswer(key: string, answers: readonly ProgressivePreferenceAnswer[], now: Date): boolean {
  const answer = answers.find((entry) => entry.key === key);
  if (!answer) return false;
  if (answer.response === "favor" || answer.response === "avoid" || answer.response === "neutral") return true;
  const answeredMs = Date.parse(answer.answeredAt);
  return Number.isFinite(answeredMs) && now.getTime() < answeredMs + PROGRESSIVE_PROFILE_LATER_DAYS * DAY_MS;
}

/**
 * Ask only when a broad positive pattern or an explicit repeated dislike has at
 * least three distinct meals behind it. Zero-consumption, browsing, and editor
 * actions never manufacture a negative taste preference.
 */
export function deriveProgressivePreferencePrompt(
  history: readonly MealHistoryEntry[],
  answers: readonly ProgressivePreferenceAnswer[] = [],
  now = new Date(),
): ProgressivePreferencePrompt | undefined {
  const positive = new Map<string, Evidence>();
  const negative = new Map<string, Evidence>();

  history.slice(0, 24).forEach((entry, index) => {
    const positiveBase = positiveEvidenceWeight(entry);
    const explicitDislike = entry.explicitFeedback === "dislike";
    if (positiveBase <= 0 && !explicitDislike) return;
    const recency = 1 / (1 + index * 0.15);
    const text = buildText(entry.build);
    const seen = new Set<string>();
    for (const family of FAMILIES) {
      if (!family.matcher.test(text)) continue;
      const key = keyFor(family.kind, family.value);
      if (seen.has(key)) continue;
      seen.add(key);
      if (positiveBase > 0) {
        const current = positive.get(key) ?? { weight: 0, count: 0 };
        positive.set(key, { weight: current.weight + positiveBase * recency, count: current.count + 1 });
      }
      if (explicitDislike) {
        const current = negative.get(key) ?? { weight: 0, count: 0 };
        negative.set(key, { weight: current.weight + 1.4 * recency, count: current.count + 1 });
      }
    }
  });

  const candidates = FAMILIES.flatMap((family) => {
    const key = keyFor(family.kind, family.value);
    if (blockedByAnswer(key, answers, now)) return [];
    const positiveRow = positive.get(key);
    const negativeRow = negative.get(key);
    const rows: Array<ProgressivePreferencePrompt & { score: number }> = [];
    if (negativeRow && negativeRow.count >= 3 && negativeRow.weight >= 2.5) {
      rows.push({
        key,
        kind: family.kind,
        value: family.value,
        label: family.label,
        evidenceCount: negativeRow.count,
        direction: "avoid",
        question: `You’ve said “Skip next time” on ${family.label} a few times. Want fewer like that?`,
        score: negativeRow.weight + negativeRow.count * 0.3 + 1,
      });
    }
    if (positiveRow && positiveRow.count >= 3 && positiveRow.weight >= 2.2) {
      rows.push({
        key,
        kind: family.kind,
        value: family.value,
        label: family.label,
        evidenceCount: positiveRow.count,
        direction: "favor",
        question: family.kind === "protein"
          ? `You keep choosing ${family.label}. Want Falcon Fuel to favor them a little more?`
          : `You keep choosing ${family.label}. Want Falcon Fuel to favor that style a little more?`,
        score: positiveRow.weight + positiveRow.count * 0.2 + (family.kind === "protein" ? 0.05 : 0),
      });
    }
    return rows;
  }).sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount || a.key.localeCompare(b.key));

  const best = candidates[0];
  if (!best) return undefined;
  const { score: _score, ...prompt } = best;
  void _score;
  return prompt;
}
