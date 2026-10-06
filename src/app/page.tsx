"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { browserProfileRepository } from "@/services/profileRepository";

export default function Home() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const profile = browserProfileRepository().get();
    router.replace(profile ? "/today" : "/onboarding");
  }, [router]);

  return (
    <main className="relative grid min-h-[100svh] w-full place-items-center overflow-hidden bg-[var(--ff-canvas)] px-6 text-[var(--ff-text-primary)]">
      <motion.div
        className="relative text-center"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-4xl font-black tracking-[-0.055em] sm:text-5xl">Falcon Fuel</p>
        <p className="mt-3 text-xs font-bold uppercase tracking-[.18em] text-[var(--ff-text-secondary)]">Loading…</p>
      </motion.div>
    </main>
  );
}
