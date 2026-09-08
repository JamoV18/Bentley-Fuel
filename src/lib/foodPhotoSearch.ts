export type OpenverseImageCandidate = {
  id?: string;
  title?: string;
  creator?: string;
  creator_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  foreign_landing_url?: string;
  url?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  category?: string;
  provider?: string;
  source?: string;
  tags?: Array<{ name?: string; accuracy?: number }>;
};

export type RankedFoodPhotoCandidate = OpenverseImageCandidate & {
  score: number;
  query: string;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "bar", "build", "byo", "cup", "fat", "for", "fresh", "low", "of", "own", "the", "with",
]);

const VISUAL_PENALTY = /\b(vector|illustration|clipart|clip art|drawing|icon|logo|diagram|painting|cartoon|sketch|graphic)\b/i;
const FOOD_SIGNAL = /\b(food|meal|plate|bowl|breakfast|lunch|dinner|chicken|beef|pork|turkey|fish|salmon|shrimp|pasta|pizza|burger|sandwich|wrap|salad|soup|rice|noodle|egg|omelet|oatmeal|yogurt|smoothie|vegetable|broccoli|spinach|potato|taco|quesadilla|burrito|dessert|cake|cookie|bread)\b/i;
const COMMERCIAL_SAFE_LICENSES = new Set(["cc0", "pdm", "by", "by-sa"]);

export function normalizedFoodWords(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bdoc-[a-z0-9-]+-item-/g, " ")
    .replace(/[+&/,_()-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word))
    .filter((word) => !/^\d+$/.test(word))
    .filter((word) => word.length > 1);
}

function humanizeLiveId(value: string): string {
  const match = value.match(/item-([a-z0-9-]+?)(?:-[a-f0-9]{12,})?$/i);
  return match ? match[1].replace(/-/g, " ") : value;
}

export function foodPhotoFamilyQuery(name: string): string {
  const raw = humanizeLiveId(name).toLowerCase();
  if (/smoothie|shake/.test(raw)) return "fruit smoothie drink";
  if (/omelet|omelette/.test(raw)) return "omelet breakfast plate";
  if (/oatmeal|overnight oats|porridge/.test(raw)) return "oatmeal breakfast bowl";
  if (/yogurt/.test(raw)) return "yogurt breakfast bowl";
  if (/egg|pancake|waffle|sausage|breakfast/.test(raw)) return "breakfast plate";
  if (/cheesesteak|philly/.test(raw)) return "cheesesteak sandwich";
  if (/burger|hamburger/.test(raw)) return "burger plate";
  if (/sandwich|hoagie|sub\b|panini|wrap/.test(raw)) return "sandwich plate";
  if (/pizza|flatbread/.test(raw)) return "pizza plate";
  if (/pasta|ravioli|tortellini|spaghetti|linguine|macaroni|lasagna/.test(raw)) return "pasta dish";
  if (/noodle|ramen|lo mein/.test(raw)) return "noodle bowl";
  if (/taco|quesadilla|burrito|nacho/.test(raw)) return "mexican food plate";
  if (/salad|romaine|greens/.test(raw)) return "salad bowl";
  if (/soup|chowder|bisque|chili/.test(raw)) return "soup bowl";
  if (/chicken/.test(raw)) return "chicken dinner plate";
  if (/turkey/.test(raw)) return "turkey dinner plate";
  if (/beef|steak/.test(raw)) return "beef dinner plate";
  if (/pork|ham/.test(raw)) return "pork dinner plate";
  if (/salmon|fish|cod|tilapia|tuna/.test(raw)) return "fish dinner plate";
  if (/shrimp|seafood/.test(raw)) return "seafood dinner plate";
  if (/rice|grain|quinoa|couscous/.test(raw)) return "rice grain bowl";
  if (/broccoli|spinach|vegetable|carrot|beans|zucchini|squash/.test(raw)) return "vegetable side dish";
  if (/cake|cookie|brownie|doughnut|donut|danish|dessert|pie/.test(raw)) return "dessert plate";
  if (/bread|roll|bagel|toast/.test(raw)) return "bread bakery food";
  return "restaurant meal plate";
}

export function foodPhotoSearchQueries(name: string): string[] {
  const humanized = humanizeLiveId(name)
    .replace(/\s*\+\s*/g, " ")
    .replace(/\b(?:low fat|fat free|reduced fat|gluten free|vegan|vegetarian|house made|homestyle|build your own|bar)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalizedFoodWords(humanized);
  const compact = words.slice(0, 7).join(" ");
  const family = foodPhotoFamilyQuery(humanized);
  return [...new Set([humanized, compact, family].filter((value) => value.length >= 3))].slice(0, 3);
}

function candidateText(candidate: OpenverseImageCandidate): string {
  return [
    candidate.title,
    ...(candidate.tags ?? []).filter((tag) => (tag.accuracy ?? 1) >= 0.45).map((tag) => tag.name),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function isCommercialSafeOpenverseCandidate(candidate: OpenverseImageCandidate): boolean {
  const license = candidate.license?.toLowerCase();
  if (!license || !COMMERCIAL_SAFE_LICENSES.has(license)) return false;
  if (!candidate.url && !candidate.thumbnail) return false;
  if (candidate.category && candidate.category !== "photograph") return false;
  const text = candidateText(candidate);
  if (VISUAL_PENALTY.test(text)) return false;
  return true;
}

export function scoreFoodPhotoCandidate(candidate: OpenverseImageCandidate, name: string, query: string): number {
  if (!isCommercialSafeOpenverseCandidate(candidate)) return Number.NEGATIVE_INFINITY;
  const targetWords = new Set(normalizedFoodWords(name));
  const text = candidateText(candidate);
  const textWords = new Set(normalizedFoodWords(text));
  let overlap = 0;
  for (const word of targetWords) if (textWords.has(word)) overlap += 1;

  let score = overlap * 10;
  const normalizedQuery = query.toLowerCase().trim();
  if (normalizedQuery && text.includes(normalizedQuery)) score += 22;
  if (FOOD_SIGNAL.test(text)) score += 6;

  const width = Number(candidate.width) || 0;
  const height = Number(candidate.height) || 0;
  if (width >= 1600) score += 10;
  else if (width >= 1200) score += 7;
  else if (width >= 900) score += 4;
  else if (width > 0 && width < 640) score -= 12;

  if (height >= 700) score += 4;
  const ratio = width > 0 && height > 0 ? width / height : 0;
  if (ratio >= 1.15 && ratio <= 2.15) score += 7;
  else if (ratio > 0 && (ratio < 0.72 || ratio > 2.8)) score -= 8;

  if (candidate.source === "flickr" || candidate.provider === "flickr") score += 2;
  if (candidate.license === "cc0" || candidate.license === "pdm") score += 2;
  return score;
}

export function rankFoodPhotoCandidates(candidates: OpenverseImageCandidate[], name: string, query: string): RankedFoodPhotoCandidate[] {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreFoodPhotoCandidate(candidate, name, query), query }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score);
}
