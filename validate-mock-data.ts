/**
 * Dev script: validate the mock dataset's referential integrity and print a
 * summary. Run with: `npm run validate:data`
 */
import { mockDiningDataset } from "@/data/mock";
import { validateDataset } from "@/lib/validateDataset";
import { computeBuild, type ComponentSelection } from "@/services/nutrition";

const report = validateDataset(mockDiningDataset);

console.log("Bentley Fuel — mock dataset report");
console.log("==================================");
console.log("Counts:", report.counts);
console.log("OK:", report.ok);

if (report.issues.length === 0) {
  console.log("No integrity issues found. ✅");
} else {
  console.log(`\n${report.issues.length} issue(s):`);
  for (const issue of report.issues) {
    console.log(`  [${issue.severity}] ${issue.entity} ${issue.id}: ${issue.message}`);
  }
}

// Smoke-test the live build math on a sample Brito bowl.
const index = new Map(mockDiningDataset.components.map((c) => [c.id, c]));
const sampleBuild: ComponentSelection[] = [
  { componentId: "comp-brito-rice-brown", quantity: 1 },
  { componentId: "comp-brito-chicken", quantity: 2 }, // double protein
  { componentId: "comp-brito-black-beans", quantity: 1 },
  { componentId: "comp-brito-guacamole", quantity: 1 },
  { componentId: "comp-brito-shredded-cheese", quantity: 1 },
];
const build = computeBuild({ calories: 0, protein: 0, carbs: 0, fat: 0 }, sampleBuild, index);
console.log("\nSample Brito build (brown rice, double chicken, black beans, guac, cheese):");
console.log("  Macros:", {
  calories: build.nutrition.calories,
  protein: build.nutrition.protein,
  carbs: build.nutrition.carbs,
  fat: build.nutrition.fat,
});
console.log("  Allergens:", build.allergens);
console.log("  Shared dietary tags:", build.dietaryTags);

if (!report.ok) process.exit(1);
