"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { activityCheckInStatus, browserActivityCheckInRepository } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";

/**
 * A due activity review should not depend on the student remembering to visit
 * the Plan tab. Once the 14-day boundary is crossed, this banner appears on the
 * main app surfaces until a review record is completed.
 */
export default function ActivityReviewDueBanner() {
  const [due, setDue] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const profile = browserProfileRepository().get();
      if (!profile) return setDue(false);
      const records = browserActivityCheckInRepository().getRecent();
      setDue(activityCheckInStatus(profile, records, new Date()).due);
    });
  }, []);

  if (!due) return null;

  return (
    <aside className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3" aria-label="Activity review due">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.1em] text-amber-800">Two-week activity review due</p>
        <p className="mt-1 text-sm font-medium text-amber-950">Confirm whether your routine still matches your activity level before Falcon Fuel changes any derived plan.</p>
      </div>
      <Link href="/profile-summary#activity-check-in" className="rounded-full bg-amber-900 px-4 py-2 text-sm font-bold text-white">Review activity</Link>
    </aside>
  );
}
