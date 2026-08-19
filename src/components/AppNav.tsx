import Link from "next/link";

export default function AppNav() {
  return (
    <nav className="mt-6 grid grid-cols-4 gap-1 rounded-2xl border border-black/10 bg-white p-1 text-center text-xs font-semibold shadow-sm" aria-label="Bentley Fuel app navigation">
      <Link className="rounded-xl px-2 py-3 hover:bg-emerald-50 hover:text-emerald-900" href="/today">Today</Link>
      <Link className="rounded-xl px-2 py-3 hover:bg-emerald-50 hover:text-emerald-900" href="/dashboard">Eat</Link>
      <Link className="rounded-xl px-2 py-3 hover:bg-emerald-50 hover:text-emerald-900" href="/history">History</Link>
      <Link className="rounded-xl px-2 py-3 hover:bg-emerald-50 hover:text-emerald-900" href="/profile-summary">Profile</Link>
    </nav>
  );
}
