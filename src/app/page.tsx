import Link from "next/link";
import MealImage from "@/components/MealImage";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-12 sm:py-16">
      <div className="grid w-full items-center gap-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-12">
        <section className="max-w-xl">
          <p className="brand-kicker">Bentley Fuel</p>
          <h1 className="mt-6 text-5xl font-bold tracking-[-0.055em] sm:text-6xl lg:text-7xl">Eat with purpose.<br /><span className="display-brand font-normal text-emerald-900">Fuel your best.</span></h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed subtle">Personalized campus nutrition that turns your goals into simple meal decisions — then learns from what you actually eat.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href="/onboarding" className="primary text-center text-base">Build my nutrition plan</Link>
            <Link href="/today" className="secondary text-center">Open Bentley Fuel</Link>
          </div>
          <Link href="/profile-summary" className="mt-5 inline-flex text-sm font-bold text-emerald-800">View saved profile →</Link>
          <p className="mt-8 text-xs subtle">Current menus and nutrition are demo data. Profile data stays on this device.</p>
        </section>

        <section className="surface overflow-hidden p-2">
          <MealImage name="healthy performance bowl" aspect="hero" className="min-h-72 sm:min-h-96 lg:min-h-[32rem]" />
          <div className="grid grid-cols-3 gap-2 p-4 text-center">
            <div><p className="text-xl font-bold text-emerald-950">1 tap</p><p className="mt-1 text-[11px] subtle">meal choices</p></div>
            <div><p className="text-xl font-bold text-emerald-950">Live</p><p className="mt-1 text-[11px] subtle">daily macros</p></div>
            <div><p className="text-xl font-bold text-emerald-950">Smart</p><p className="mt-1 text-[11px] subtle">recommendations</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}
