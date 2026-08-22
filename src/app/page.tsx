import Link from "next/link";
import { redirect } from "next/navigation";
import { RECORDING_DEMO_ENABLED } from "@/lib/recordingDemo";

export default function Home() {
  if (RECORDING_DEMO_ENABLED) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12">
      <p className="text-sm font-bold text-emerald-700">BENTLEY UNIVERSITY</p>
      <h1 className="mt-3 text-5xl font-bold tracking-tight">Fuel your day.</h1>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-black/60">
        Create a quick nutrition profile for future personalized campus dining recommendations.
      </p>
      <Link href="/onboarding" className="primary mt-8 text-center text-lg">Create my profile</Link>
      <Link href="/profile-summary" className="mt-4 text-center font-semibold text-emerald-800 underline">View saved profile</Link>
      <p className="mt-10 text-xs text-black/45">Menus and nutrition remain mock data. No profile information leaves this device.</p>
    </main>
  );
}
