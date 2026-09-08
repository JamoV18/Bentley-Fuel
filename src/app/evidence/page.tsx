import Link from "next/link";
import FlowHeader from "@/components/FlowHeader";
import "./evidence.css";

const REFERENCES = [
  {
    year: "2023",
    title: "Dietary Reference Intakes for Energy",
    detail: "National Academies of Sciences, Engineering, and Medicine · energy-requirement equations by age, sex, body size, and activity level.",
    href: "https://doi.org/10.17226/26818",
  },
  {
    year: "2018",
    title: "Protein supplementation and resistance-training adaptations: systematic review, meta-analysis and meta-regression",
    detail: "Morton et al., British Journal of Sports Medicine · evidence supporting ~1.6 g protein/kg/day as a useful upper planning point for healthy adults doing resistance training.",
    href: "https://doi.org/10.1136/bjsports-2017-097608",
  },
  {
    year: "2005",
    title: "Dietary Reference Intakes for Macronutrients",
    detail: "Institute of Medicine / National Academies · reference ranges for carbohydrate, fat, protein, and other macronutrients.",
    href: "https://doi.org/10.17226/10490",
  },
  {
    year: "DATA",
    title: "Bentley Dining · DineOnCampus menu",
    detail: "The published campus menu source Falcon Fuel attempts to verify before using live dining information.",
    href: "https://dineoncampus.com/bentley/whats-on-the-menu",
  },
] as const;

export default function EvidencePage() {
  return (
    <main className="ff-page-shell ff-evidence">
      <FlowHeader backHref="/profile" backLabel="Profile" />

      <header className="ff-evidence-header">
        <div>
          <p className="brand-kicker">Falcon Fuel</p>
          <h1>Evidence & methodology</h1>
        </div>
        <p>
          A quiet record of what Falcon Fuel bases its nutrition planning on, what comes from Bentley Dining,
          and which parts are product guardrails rather than medical guidance.
        </p>
      </header>

      <section className="ff-evidence-intro" aria-label="Falcon Fuel methodology">
        <aside className="ff-evidence-index">
          <span>How to read this</span>
          <strong>Evidence where it exists. Clear labels where judgment is involved.</strong>
          <p>Falcon Fuel is a decision-support product, not medical care. Research informs the planning layer; campus menu data and your own behavior shape the actual meal recommendation.</p>
        </aside>

        <div className="ff-evidence-body">
          <article className="ff-evidence-row">
            <h2>Energy estimates</h2>
            <div>
              <p>When Falcon Fuel has the required profile inputs, maintenance energy is derived from the 2023 National Academies Dietary Reference Intakes for Energy rather than from a generic one-size-fits-all calorie number.</p>
              <span className="ff-evidence-tag">Research-backed basis</span>
            </div>
          </article>

          <article className="ff-evidence-row">
            <h2>Protein planning</h2>
            <div>
              <p>For a muscle-building goal, Falcon Fuel can raise the protein target toward 1.6 g/kg/day when that is higher than the baseline macro pattern. That planning point is supported by a large resistance-training meta-analysis in healthy adults.</p>
              <span className="ff-evidence-tag">Research-backed basis</span>
            </div>
          </article>

          <article className="ff-evidence-row">
            <h2>Macro pattern</h2>
            <div>
              <p>The baseline protein, carbohydrate, and fat pattern is kept within broad National Academies macronutrient reference ranges. Falcon Fuel then adapts the meal ranking around the remaining daily targets rather than treating one macro ratio as universally optimal.</p>
              <span className="ff-evidence-tag">Reference-range basis</span>
            </div>
          </article>

          <article className="ff-evidence-row">
            <h2>Weight-loss intensity</h2>
            <div>
              <p>The Light / Moderate / Optimal / Extreme percentage reductions are Falcon Fuel planning settings. They are not presented as four clinically validated prescriptions. The app also uses conservative product guardrails, including not automatically prescribing a calorie deficit to a minor.</p>
              <span className="ff-evidence-tag">Product policy</span>
            </div>
          </article>

          <article className="ff-evidence-row">
            <h2>Dining data</h2>
            <div>
              <p>Where the live source can be verified, food names, stations, nutrition, allergens, and availability are grounded in published Bentley Dining / DineOnCampus information. Falcon Fuel labels demo or unavailable menu states rather than silently presenting them as verified campus facts.</p>
              <span className="ff-evidence-tag">Source provenance</span>
            </div>
          </article>

          <article className="ff-evidence-row">
            <h2>Personalization</h2>
            <div>
              <p>Location habits, repeated meal choices, explicit likes/dislikes, portion corrections, and recent variety are used as bounded ranking signals. They can reorder otherwise eligible meals, but they do not override allergy restrictions or turn a preference into a medical rule.</p>
              <span className="ff-evidence-tag">Behavioral product logic</span>
            </div>
          </article>

          <article className="ff-evidence-row">
            <h2>Known limits</h2>
            <div>
              <p>Published nutrition and portions can differ from what is actually served. Energy needs are estimates. Falcon Fuel should not be used to diagnose, treat, or manage a medical condition, and students with medically important allergies should continue following Bentley Dining’s official allergy procedures and staff guidance.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="ff-evidence-references" aria-labelledby="references-heading">
        <div className="ff-evidence-references-head">
          <div><p className="eyebrow">Primary sources</p><h2 id="references-heading">What we point back to</h2></div>
          <p>This list is intentionally short. It covers the main external foundations currently represented in Falcon Fuel’s calculation and data layers rather than padding the page with loosely related nutrition articles.</p>
        </div>

        {REFERENCES.map((reference) => (
          <a className="ff-evidence-ref" href={reference.href} target="_blank" rel="noreferrer" key={reference.href}>
            <span>{reference.year}</span>
            <div><strong>{reference.title}</strong><p>{reference.detail}</p></div>
            <i aria-hidden="true">↗</i>
          </a>
        ))}

        <p className="ff-evidence-note"><strong>Prototype note.</strong> This page documents the current Falcon Fuel implementation and should evolve when the target formulas, campus data source, or recommendation logic materially changes. Last product review: September 2026.</p>
      </section>

      <Link href="/profile" className="secondary inline-flex items-center justify-center">Back to profile</Link>
    </main>
  );
}
