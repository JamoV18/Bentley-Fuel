import Link from "next/link";
import MealImage from "@/components/MealImage";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12">
      <p className="brand-kicker">Bentley Fuel</p>
      <h1 className="mt-6 text-5xl font-bold tracking-[-0.055em] sm:text-6xl">Eat with purpose.<br /><span className="display-brand font-normal text-emerald-900">Fuel your best.</span></h1>
      <p className="mt-5 max-w-md text-lg leading-relaxed subtle">Personalized campus nutrition that turns your goals into simple meal decisions — then learns from what you actually eat.</p>
      <div className="surface mt-8 overflow-hidden p-2"><MealImage name="healthy performance bowl" aspect="hero" /><div className="grid grid-cols-3 gap-2 p-3 text-center"><div><p className="text-lg font-bold text-emerald-950">1 tap</p><p className="text-[10px] subtle">meal choices</p></div><div><p className="text-lg font-bold text-emerald-950">Live</p><p className="text-[10px] subtle">daily macros</p></div><div><p className="text-lg font-bold text-emerald-950">Smart</p><p className="text-[10px] subtle">recommendations</p></div></div></div>
      <Link href="/onboarding" className="primary mt-5 text-center text-base">Build my nutrition plan</Link>
      <Link href="/today" className="secondary mt-3 text-center">Open Bentley Fuel</Link>
      <Link href="/profile-summary" className="mt-4 text-center text-sm font-bold text-emerald-800">View saved profile →</Link>
      <p className="mt-8 text-center text-xs subtle">Current menus and nutrition are demo data. Profile data stays on this device.</p>
    </main>
  );
}
