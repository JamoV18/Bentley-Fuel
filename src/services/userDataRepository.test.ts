import assert from "node:assert/strict";
import test from "node:test";
import { createLocalActivityCheckInRepository } from "./activityCheckIn";
import { createLocalMealHistoryRepository } from "./mealHistoryRepository";
import { createUserProfile } from "./profileRepository";
import { createLocalProgressiveProfileRepository } from "./progressiveProfile";
import { createLocalProgressRepository } from "./progressRepository";
import {
  FALCON_FUEL_USER_DATA_KEYS,
  createLocalUserDataRepository,
  parseFalconFuelUserDataImport,
  previewFalconFuelUserDataImport,
} from "./userDataRepository";

class MemoryStorage {
  protected values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

class FailOnceStorage extends MemoryStorage {
  private failed = false;
  constructor(private readonly failureKey: string) { super(); }
  override setItem(key: string, value: string) {
    if (key === this.failureKey && !this.failed) {
      this.failed = true;
      throw new Error("simulated storage failure");
    }
    super.setItem(key, value);
  }
}

const profile = () => createUserProfile({
  primaryGoal: "maintain-weight",
  goals: ["maintain-weight"],
  goalDescription: "Maintain energy through the semester",
  dietaryPreferences: [],
  allergensToAvoid: [],
  breakfastPreferences: ["eggs", "yogurt", "smoothie-fruit"],
  maintenanceEstimate: { calories: 2400, method: "national-academies-2023-adult-eer" },
  dailyTargets: { calories: 2400, protein: 140, carbs: 300, fat: 70 },
  unitSystem: "us",
  behavioralGoals: ["consistency"],
  metrics: { age: 20, sex: "male", heightCm: 178, weightKg: 75, activityLevel: "active" },
});

const seedPortableData = (storage: MemoryStorage) => {
  const created = profile();
  storage.setItem("bentley-fuel.profile.v1", JSON.stringify(created));
  createLocalMealHistoryRepository(storage).upsert({
    id: "meal-1",
    locationId: "loc-921",
    build: { locationId: "loc-921", items: [{ id: "line-1", menuItemId: "item-1", quantity: 1 }] },
    selectedAt: "2026-08-31T16:00:00.000Z",
    source: "recommended",
  });
  createLocalProgressRepository(storage).upsert({
    id: "weight-1",
    recordedAt: "2026-08-31T16:00:00.000Z",
    weightKg: 75,
  });
  createLocalActivityCheckInRepository(storage).upsert({
    id: "activity-1",
    recordedAt: "2026-08-31T17:00:00.000Z",
    previousLevel: "low-active",
    confirmedLevel: "active",
  });
  createLocalProgressiveProfileRepository(storage).upsert({
    id: "preference-1",
    key: "protein:chicken",
    kind: "protein",
    value: "chicken",
    label: "chicken-based meals",
    response: "favor",
    evidenceCount: 3,
    answeredAt: "2026-08-31T18:00:00.000Z",
  });
  return created;
};

test("export keeps profile, meals, progress, reviews, preferences, and recommendation interactions distinct", () => {
  const storage = new MemoryStorage();
  const data = createLocalUserDataRepository(storage);
  const created = seedPortableData(storage);

  const exported = data.exportData();
  assert.equal(exported.schemaVersion, 2);
  assert.equal(exported.storageScope, "this-device");
  assert.equal(exported.profile?.id, created.id);
  assert.deepEqual(exported.profile?.breakfastPreferences, ["eggs", "yogurt", "smoothie-fruit"]);
  assert.equal(exported.mealHistory.length, 1);
  assert.equal(exported.mealHistory[0].selectedAt, "2026-08-31T16:00:00.000Z");
  assert.equal(exported.mealHistory[0].eatenAt, undefined);
  assert.equal(exported.progress.length, 1);
  assert.equal(exported.activityCheckIns.length, 1);
  assert.equal(exported.activityCheckIns[0].confirmedLevel, "active");
  assert.equal(exported.progressivePreferences.length, 1);
  assert.equal(exported.progressivePreferences[0].key, "protein:chicken");
  assert.equal(exported.recommendationInteractions.length, 1);
  assert.equal(exported.recommendationInteractions[0].kind, "meal-chosen");
  assert.equal(data.summary().progressivePreferenceCount, 1);
  assert.equal(data.summary().recommendationInteractionCount, 1);
});

test("export preserves the raw stored profile instead of serializing read-time derived targets", () => {
  const storage = new MemoryStorage();
  const created = createUserProfile({
    primaryGoal: "maintain-weight",
    goals: ["maintain-weight"],
    dietaryPreferences: [],
    allergensToAvoid: [],
    breakfastPreferences: ["eggs"],
    maintenanceEstimate: { calories: 2400, method: "national-academies-2023-adult-eer" },
    dailyTargets: undefined,
    unitSystem: "us",
    behavioralGoals: [],
    metrics: { age: 20, sex: "male", heightCm: 178, weightKg: 75, activityLevel: "active" },
  });
  storage.setItem("bentley-fuel.profile.v1", JSON.stringify(created));
  const exported = createLocalUserDataRepository(storage).exportData();
  assert.equal(exported.profile?.dailyTargets, undefined);
  assert.deepEqual(exported.profile?.breakfastPreferences, ["eggs"]);
});

test("a valid export can be previewed and restored exactly without generating extra interaction events", () => {
  const source = new MemoryStorage();
  seedPortableData(source);
  const exported = createLocalUserDataRepository(source).exportData();
  const target = new MemoryStorage();
  target.setItem("unrelated-app-key", "keep-me");
  target.setItem("bentley-fuel.progress.v1", JSON.stringify([{ id: "old", recordedAt: "2026-01-01T12:00:00.000Z", weightKg: 90 }]));

  const targetData = createLocalUserDataRepository(target);
  const preview = targetData.previewImport(exported);
  assert.equal(preview.valid, true);
  assert.equal(preview.summary?.mealHistoryCount, 1);
  assert.equal(preview.summary?.recommendationInteractionCount, 1);

  const restoredSummary = targetData.replaceFromExport(exported);
  const restored = targetData.exportData();
  assert.equal(restoredSummary.progressObservationCount, 1);
  assert.deepEqual(restored.profile, exported.profile);
  assert.deepEqual(restored.profile?.breakfastPreferences, ["eggs", "yogurt", "smoothie-fruit"]);
  assert.deepEqual(restored.mealHistory, exported.mealHistory);
  assert.deepEqual(restored.progress, exported.progress);
  assert.deepEqual(restored.activityCheckIns, exported.activityCheckIns);
  assert.deepEqual(restored.progressivePreferences, exported.progressivePreferences);
  assert.deepEqual(restored.recommendationInteractions, exported.recommendationInteractions);
  assert.equal(target.getItem("unrelated-app-key"), "keep-me");
});

test("invalid or duplicate records are rejected before any Falcon Fuel key is changed", () => {
  const storage = new MemoryStorage();
  seedPortableData(storage);
  const data = createLocalUserDataRepository(storage);
  const before = FALCON_FUEL_USER_DATA_KEYS.map((key) => [key, storage.getItem(key)] as const);
  const invalid = data.exportData();
  invalid.progress = [
    { id: "duplicate", recordedAt: "2026-08-01T12:00:00.000Z", weightKg: 75 },
    { id: "duplicate", recordedAt: "2026-08-02T12:00:00.000Z", weightKg: 76 },
  ];

  const preview = previewFalconFuelUserDataImport(invalid);
  assert.equal(preview.valid, false);
  assert.match(preview.errors.join(" "), /duplicate/i);
  assert.throws(() => data.replaceFromExport(invalid), /duplicate/i);
  before.forEach(([key, value]) => assert.equal(storage.getItem(key), value));
});

test("unsupported versions and malformed JSON fail closed", () => {
  const storage = new MemoryStorage();
  const data = createLocalUserDataRepository(storage);
  const exported = data.exportData() as unknown as Record<string, unknown>;
  exported.schemaVersion = 999;
  assert.equal(data.previewImport(exported).valid, false);
  assert.match(data.previewImport(exported).errors.join(" "), /unsupported data version/i);
  assert.equal(parseFalconFuelUserDataImport("{ definitely-not-json").valid, false);
});

test("a browser storage failure rolls every Falcon Fuel key back instead of leaving a partial identity", () => {
  const source = new MemoryStorage();
  seedPortableData(source);
  const exported = createLocalUserDataRepository(source).exportData();

  const target = new FailOnceStorage("bentley-fuel.progress.v1");
  target.setItem("bentley-fuel.profile.v1", JSON.stringify(profile()));
  target.setItem("bentley-fuel.meal-history.v1", "[]");
  const before = FALCON_FUEL_USER_DATA_KEYS.map((key) => [key, target.getItem(key)] as const);
  assert.throws(() => createLocalUserDataRepository(target).replaceFromExport(exported), /simulated storage failure/);
  before.forEach(([key, value]) => assert.equal(target.getItem(key), value));
});

test("clearAll removes all Falcon Fuel nutrition data without relying on localStorage.clear", () => {
  const storage = new MemoryStorage();
  const data = createLocalUserDataRepository(storage);
  const created = profile();
  storage.setItem("bentley-fuel.profile.v1", JSON.stringify(created));
  storage.setItem("bentley-fuel.meal-history.v1", "[]");
  storage.setItem("bentley-fuel.progress.v1", "[]");
  storage.setItem("bentley-fuel.activity-check-ins.v1", "[]");
  storage.setItem("bentley-fuel.progressive-profile.v1", "[]");
  storage.setItem("bentley-fuel.recommendation-interactions.v1", "[]");
  storage.setItem("unrelated-app-key", "keep-me");

  data.clearAll();

  assert.equal(data.summary().profileStored, false);
  assert.equal(storage.getItem("bentley-fuel.meal-history.v1"), null);
  assert.equal(storage.getItem("bentley-fuel.progress.v1"), null);
  assert.equal(storage.getItem("bentley-fuel.activity-check-ins.v1"), null);
  assert.equal(storage.getItem("bentley-fuel.progressive-profile.v1"), null);
  assert.equal(storage.getItem("bentley-fuel.recommendation-interactions.v1"), null);
  assert.equal(storage.getItem("unrelated-app-key"), "keep-me");
});
