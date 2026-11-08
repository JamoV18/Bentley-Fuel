import test from "node:test";
import assert from "node:assert/strict";
import type { MenuItem, RecommendationContext } from "@/types";
import { bentleyDiningHour, bentleyMenuDate } from "@/lib/bentleyDiningDate";
import { publishedFor } from "./diningAvailability";
import { assessMenuItemEligibility } from "./recommendationEligibility";
import { canonicalFoodFromMenuItem, rankCanonicalFoods } from "./canonicalFoodCatalog";
import { MemoryDiningSnapshotRepository } from "./diningSnapshotRepository";
import { ReliableDineOnCampusProvider } from "./reliableDineOnCampusProvider";
import { build921BrowserSnapshot } from "./manual921Sync";

const item: MenuItem = {id:"one",name:"Rice",locationId:"loc-921",stationId:"s",kind:"predefined",allergens:[],dietaryTags:[],nutrition:{calories:100,protein:3,carbs:21,fat:1},availability:["lunch"],menuDate:"2026-11-03",availabilityStatus:"verified-snapshot",provenance:{dataStatus:"verified",source:{type:"bentley-dining",name:"Test source"},confidence:1}};
const context = {locationId:"loc-921",menuDate:"2026-11-03",mealPeriod:"lunch",profile:{allergensToAvoid:[],dietaryPreferences:[]}} as unknown as RecommendationContext;
function snapshot(date: string) {
  return build921BrowserSnapshot({schemaVersion:1,source:"dineoncampus-browser-dom",menuDate:date,capturedAt:date+"T12:00:00Z",upstreamLocationId:"921",periods:[{name:"Lunch",categories:[{name:"Station",items:[{name:"Rice"}]}]}]}).snapshot;
}

test("availability and recommendation eligibility require the requested service date and period", () => {
  for (const menuDate of ["2026-11-02","2026-11-03","2026-11-04"]) {
    for (const mealPeriod of ["breakfast","lunch","dinner"] as const) {
      const expected = menuDate === item.menuDate && mealPeriod === "lunch";
      assert.equal(publishedFor(item,menuDate,mealPeriod),expected);
      assert.equal(assessMenuItemEligibility(item,{...context,menuDate,mealPeriod}).isEligible,expected);
    }
  }
  assert.equal(publishedFor({...item,availability:[]},item.menuDate,"lunch"),false);
  assert.equal(publishedFor({...item,menuDate:undefined},item.menuDate,"lunch"),false);
  assert.equal(publishedFor({...item,availability:["all-day"]},item.menuDate,"dinner"),true);
  assert.equal(publishedFor({...item,availabilityStatus:"stale"},item.menuDate,"lunch"),false);
});

test("canonical search boosts only the matching dated offering and retains historical food for logging", () => {
  const previous = canonicalFoodFromMenuItem({...item,stationId:"previous",menuDate:"2026-11-02"})!;
  const lunch = canonicalFoodFromMenuItem(item)!;
  const dinner = canonicalFoodFromMenuItem({...item,stationId:"dinner",availability:["dinner"]})!;
  assert.equal(rankCanonicalFoods("Rice",[previous,dinner,lunch],[],{menuDate:item.menuDate,mealSlot:"lunch"})[0].foodId,lunch.foodId);
  assert.equal(rankCanonicalFoods("Rice",[previous,lunch,dinner],[],{menuDate:item.menuDate,mealSlot:"dinner"})[0].foodId,dinner.foodId);
  assert.equal(rankCanonicalFoods("Rice",[lunch,previous],[],{menuDate:"2026-11-02",mealSlot:"lunch"})[0].foodId,previous.foodId);
  assert.equal(rankCanonicalFoods("Rice",[previous],[],{menuDate:item.menuDate}).length,1);
});

test("Bentley dates and clock are independent of UTC midnight and daylight saving boundaries", () => {
  for (const [instant,date,hour] of [
    ["2026-11-04T04:59:59Z","2026-11-03",23], ["2026-11-04T05:00:00Z","2026-11-04",0],
    ["2026-03-08T06:59:59Z","2026-03-08",1], ["2026-03-08T07:00:00Z","2026-03-08",3],
    ["2026-11-01T05:30:00Z","2026-11-01",1], ["2026-11-01T06:30:00Z","2026-11-01",1],
  ] as const) { assert.equal(bentleyMenuDate(new Date(instant)),date); assert.equal(bentleyDiningHour(new Date(instant)),hour); }
});

test("dated and future reads prefer their own snapshot and never republish an old pointer", async () => {
  const repo=new MemoryDiningSnapshotRepository();
  await repo.set(snapshot("2026-11-04"));
  await repo.set(snapshot("2026-11-03"));
  const provider=new ReliableDineOnCampusProvider({snapshots:repo});
  for (const date of ["2026-11-03","2026-11-04"]) {
    const rows=await provider.getMenuItems({locationId:"loc-921",date,mealPeriod:"lunch"});
    assert.equal(rows.length,1); assert.equal(rows[0].menuDate,date);
  }
  assert.equal((await repo.getCurrentPublished("921"))?.menuDate,"2026-11-03");
  assert.equal((await provider.getMenuItems({date:"2026-11-05"})).some((row)=>row.locationId==="loc-921"),false);
});

test("unknown periods are omitted, not promoted to all-day availability; impossible capture dates are rejected", () => {
  const capture={schemaVersion:1,source:"dineoncampus-browser-dom",menuDate:"2026-11-03",capturedAt:"2026-11-03T12:00:00Z",upstreamLocationId:"921",periods:[{name:"Special",categories:[{name:"Station",items:[{name:"Rice"}]}]}]};
  const built=build921BrowserSnapshot(capture);
  assert.equal(built.snapshot.items.length,0);
  assert.ok(built.preview.issues.some((i)=>i.code==="UNKNOWN_PERIOD"));
  assert.throws(()=>build921BrowserSnapshot({...capture,menuDate:"2026-02-30"}));
});
