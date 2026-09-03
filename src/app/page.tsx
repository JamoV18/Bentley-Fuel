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
    <main className="relative grid min-h-[100svh] w-full place-items-center overflow-hidden bg-[#10263d] px-6 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_20%_92%,rgba(0,117,190,.34),transparent_70%),radial-gradient(60%_50%_at_85%_12%,rgba(66,183,176,.18),transparent_68%),linear-gradient(135deg,#071726,#102f4b_54%,#0d4257)]" />
      <motion.div
        className="relative text-center"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-4xl font-black tracking-[-0.055em] sm:text-5xl">Falcon Fuel</p>
        <p className="mt-3 text-xs font-bold uppercase tracking-[.18em] text-white/45">Loading your day</p>
      </motion.div>
    </main>
  );
}
