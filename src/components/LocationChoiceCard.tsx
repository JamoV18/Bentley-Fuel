"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import LocationImage from "@/components/LocationImage";

export default function LocationChoiceCard({
  id,
  name,
  shortName,
  building,
  description,
  stationCount,
}: {
  id: string;
  name: string;
  shortName?: string;
  building?: string;
  description?: string;
  stationCount: number;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [departing, setDeparting] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const href = `/locations/${id}`;

  useEffect(() => () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
  }, []);

  const prefetch = () => router.prefetch(href);

  const chooseLocation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (departing) return;
    setDeparting(true);
    if (reduceMotion) {
      router.push(href);
      return;
    }
    timerRef.current = window.setTimeout(() => router.push(href), 145);
  };

  return (
    <motion.div
      className="h-full"
      animate={departing ? { y: 1, scale: 0.988 } : { y: 0, scale: 1 }}
      whileHover={departing || reduceMotion ? undefined : { y: -3, scale: 1.01 }}
      whileTap={departing || reduceMotion ? undefined : { y: 0, scale: 0.985 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 30, mass: 0.5 }}
    >
      <Link
        href={href}
        onClick={chooseLocation}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        aria-busy={departing || undefined}
        className={`group surface block h-full overflow-hidden p-2 transition-[border-color,box-shadow,background-color] duration-200 ${departing ? "border-emerald-700/35 bg-emerald-50/35 shadow-[0_16px_34px_rgba(20,45,34,.12)]" : "hover:border-emerald-700/30 hover:shadow-xl"}`}
      >
        <motion.div
          className="overflow-hidden rounded-[1rem]"
          animate={departing && !reduceMotion ? { scale: 1.018 } : { scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <LocationImage id={id} name={name} aspect="hero" className="h-40" />
        </motion.div>
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Dining location</p>
              <motion.h2
                className="mt-1 text-2xl font-bold tracking-tight group-hover:text-emerald-800"
                animate={departing && !reduceMotion ? { x: 2 } : { x: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                {shortName ?? name}
              </motion.h2>
            </div>
            <motion.span
              className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-800"
              animate={departing && !reduceMotion ? { x: 4, scale: 1.06 } : { x: 0, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              →
            </motion.span>
          </div>
          {building && <p className="mt-1 text-sm font-semibold subtle">{building}</p>}
          {description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed subtle">{description}</p>}
          <p className="mt-4 text-xs font-bold text-emerald-800">{stationCount} {stationCount === 1 ? "dining concept" : "dining concepts"}</p>
        </div>
      </Link>
    </motion.div>
  );
}
