"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export default function Template({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex min-h-full flex-1 flex-col"
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985, filter: "blur(7px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
              filter: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
              y: { type: "spring", stiffness: 235, damping: 22, mass: 0.72 },
              scale: { type: "spring", stiffness: 275, damping: 24, mass: 0.68 },
            }
      }
      style={{ transformOrigin: "50% 18%" }}
    >
      {children}
    </motion.div>
  );
}
