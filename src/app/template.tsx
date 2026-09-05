"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export default function Template({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex min-h-full flex-1 flex-col"
      initial={reduceMotion ? false : { opacity: 0.965, y: 4, scale: 0.998, filter: "blur(1.5px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
              y: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
              filter: { duration: 0.15, ease: "easeOut" },
            }
      }
    >
      {children}
    </motion.div>
  );
}
