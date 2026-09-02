import Link from "next/link";
import FlowHeader from "@/components/FlowHeader";
import { MEAL_PERIOD_TARGET_SHARE, NATIONAL_ACADEMIES_ENERGY_REPORT_URL, WEIGHT_LOSS_INTENSITY_REDUCTION } from "@/services";

const percent = (value: number) => `${Math.round(value * 100)}%`;

export default function MethodologyPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:py-12">
      <FlowHeader backHref="/today" backLabel="Today" />
      <header className="mt-8 max-w-3xl">
        <p className="brand-kicker">Falcon Fuel methodology</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">How a recommendation is produced</h1>
        <p className="mt-4 text-base leading-relaxed subtle">Falcon Fuel separates published nutrition, scientific energy estimation, product planning rules, and personalization so the app does not present its own heuristics as outside scientific recommendations.</p>
      </header>

      <div className="mt-8 space-y-5">
        <section className="surface p-5 sm:p-7">
          <p className="eyebrow">1 · Maintenance energy</p>
          <h2 className="mt-1 text-2xl font-bold">National Academies 2023 EER equations</h2>
          <p className="mt-3 leading-relaxed subtle">When the required profile inputs are available, Falcon Fuel estimates maintenance energy from the 2023 National Academies Dietary Reference Intakes for Energy equations using age, sex, height, weight, and physical activity. Ages 17–18 use the published adolescent equation group and ages 19+ use the adult equations.</p>
          <p className="mt-3 leading-relaxed subtle">That result is an estimated maintenance requirement. Falcon Fuel does not describe a lower goal target as though the National Academies prescribed the reduction.</p>
          <a href={NATIONAL_ACADEMIES_ENERGY_REPORT_URL} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-bold text-emerald-800 underline">Read the National Academies report ↗</a>
        </section>

        <section className="surface p-5 sm:p-7">
          <p className="eyebrow">2 · Falcon Fuel plan layer</p>
          <h2 className="mt-1 text-2xl font-bold">Goal adjustments stay labeled as product rules</h2>
          <p className="mt-3 leading-relaxed subtle">For an eligible adult weight-loss plan, Falcon Fuel can apply the selected planning intensity to estimated maintenance. These percentages are Falcon Fuel planning heuristics, not National Academies recommendations.</p>
          <dl className="mt-4 grid gap-2 sm:grid-cols-4">
            {Object.entries(WEIGHT_LOSS_INTENSITY_REDUCTION).map(([name, reduction]) => <div key={name} className="rounded-xl bg-emerald-50/70 p-3"><dt className="text-xs font-semibold capitalize text-emerald-900/60">{name}</dt><dd className="mt-1 text-xl font-bold text-emerald-950">−{percent(reduction)}</dd></div>)}
          </dl>
          <p className="mt-4 text-sm leading-relaxed subtle">At age 17 Falcon Fuel can retain a weight-loss goal as intent, but it does not automatically apply a calorie deficit. The app also keeps a conservative automated calorie floor.</p>
        </section>

        <section className="surface p-5 sm:p-7">
          <p className="eyebrow">3 · Day → meal target</p>
          <h2 className="mt-1 text-2xl font-bold">Meal allocation is a planning heuristic</h2>
          <p className="mt-3 leading-relaxed subtle">When a daily calorie and macro target exists, Falcon Fuel allocates a portion of it to the current meal period, then caps that target by what remains in the day. This prevents a meal recommendation from ignoring food already confirmed as eaten.</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(MEAL_PERIOD_TARGET_SHARE).map(([period, share]) => <div key={period} className="rounded-xl bg-black/[.025] p-3"><dt className="text-xs font-semibold capitalize subtle">{period.replace("-", " ")}</dt><dd className="mt-1 font-bold">{percent(share)} of daily target</dd></div>)}
          </dl>
          <p className="mt-4 text-sm leading-relaxed subtle">These meal shares are Falcon Fuel product allocations, not a claim that one meal distribution is physiologically superior for everyone.</p>
        </section>

        <section className="surface p-5 sm:p-7">
          <p className="eyebrow">4 · Recommendation ranking</p>
          <h2 className="mt-1 text-2xl font-bold">Nutrition fit stays dominant</h2>
          <p className="mt-3 leading-relaxed subtle">With individualized daily targets, the ranking engine weights meal-level target fit most heavily, then uses goal alignment, practical meal coherence, dietary-quality guardrails, explicit meal-routine preferences, and a bounded history adjustment. Hard allergen and dietary restrictions are applied before scoring.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-900/10 p-4"><strong>Target fit</strong><p className="mt-1 text-sm subtle">Compares calories, protein, carbohydrates, and fat against the current meal target. Macro importance varies by the selected goal.</p></div>
            <div className="rounded-xl border border-emerald-900/10 p-4"><strong>Meal coherence</strong><p className="mt-1 text-sm subtle">Checks whether the foods form a plausible meal, how many stations are required, and whether combinations look like how students actually eat.</p></div>
            <div className="rounded-xl border border-emerald-900/10 p-4"><strong>Preferences and history</strong><p className="mt-1 text-sm subtle">Confirmed behavior can make a small ranking adjustment. Merely showing a recommendation does not count as preference evidence. Breakfast staples selected during onboarding receive a bounded routine-fit signal, and an established breakfast routine is not pushed toward novelty simply because it repeats.</p></div>
            <div className="rounded-xl border border-emerald-900/10 p-4"><strong>No fake health score</strong><p className="mt-1 text-sm subtle">Falcon Fuel uses internal ranking values to order candidates, but does not present the final number as an objective measure of how “healthy” a meal is.</p></div>
          </div>
          <p className="mt-4 text-sm leading-relaxed subtle">A stated routine remains subordinate to eligibility and major nutrition fit. For example, choosing eggs as a normal breakfast can never make an egg-containing item eligible for a student who has selected an egg allergy.</p>
        </section>

        <section className="surface p-5 sm:p-7">
          <p className="eyebrow">5 · Dining data and portions</p>
          <h2 className="mt-1 text-2xl font-bold">Published facts and estimates are kept separate</h2>
          <p className="mt-3 leading-relaxed subtle">Live Bentley menu items and nutrition come from Bentley Dining / DineOnCampus when Falcon Fuel can verify the menu. If a live location cannot be verified, Falcon Fuel fails closed rather than silently inserting demo food into scored recommendations.</p>
          <p className="mt-3 leading-relaxed subtle">For cafeteria serving guidance, Falcon Fuel may translate a published serving into a practical spoon estimate. The current prototype uses roughly one heaped cafeteria serving spoon ≈ ½ cup when an official utensil conversion is unavailable. That translation is explicitly labeled as an estimate; it does not replace the published serving nutrition.</p>
        </section>
      </div>

      <p className="mt-8 text-sm subtle">Want to inspect a specific meal? Open a personalized recommendation and tap <strong>Why this meal?</strong> to see the numbers used for that recommendation.</p>
      <Link href="/today" className="secondary mt-5 inline-flex">Back to Today</Link>
    </main>
  );
}
