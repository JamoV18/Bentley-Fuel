"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";

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
  const y = useMotionValue(0);
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
      y.set(0);
      return;
    }

    if (rounded === previous.current) return;
    const from = previous.current;
    previous.current = rounded;

    if (reduceMotion) {
      motionValue.set(rounded);
      y.set(0);
      return;
    }

    motionValue.set(from);
    y.set(0);
    const numberControls = animate(motionValue, rounded, {
      duration: 0.36,
      ease: [0.22, 1, 0.36, 1],
    });
    const positionControls = animate(y, [0, 2.5, 0], {
      duration: 0.36,
      times: [0, 0.58, 1],
      ease: [0.22, 1, 0.36, 1],
    });

    return () => {
      numberControls.stop();
      positionControls.stop();
    };
  }, [motionValue, reduceMotion, rounded, y]);

  const text = format ? display.toLocaleString() : String(display);

  return (
    <motion.span
      className={`inline-block tabular-nums ${className}`.trim()}
      style={{ y }}
      aria-label={`${rounded}${suffix}`}
    >
      {text}{suffix}
    </motion.span>
  );
}
