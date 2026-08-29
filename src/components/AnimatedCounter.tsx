"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";

export default function AnimatedCounter({
  value,
  suffix = "",
  className = "",
  format = true,
}: {
  value: number;
  suffix?: string;
  className?: string;
  format?: boolean;
}) {
  const rounded = Math.round(value);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(rounded);
  const [display, setDisplay] = useState(rounded);
  const previous = useRef(rounded);
  const mounted = useRef(false);

  useMotionValueEvent(motionValue, "change", (latest) => {
    setDisplay(Math.round(latest));
  });

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      previous.current = rounded;
      motionValue.set(rounded);
      return;
    }

    if (rounded === previous.current) return;
    const from = previous.current;
    previous.current = rounded;

    if (reduceMotion) {
      motionValue.set(rounded);
      setDisplay(rounded);
      return;
    }

    motionValue.set(from);
    const controls = animate(motionValue, rounded, {
      duration: 0.36,
      ease: [0.22, 1, 0.36, 1],
    });

    return () => controls.stop();
  }, [motionValue, reduceMotion, rounded]);

  const text = format ? display.toLocaleString() : String(display);

  return (
    <span className={`tabular-nums ${className}`.trim()} aria-label={`${rounded}${suffix}`}>
      {text}{suffix}
    </span>
  );
}
