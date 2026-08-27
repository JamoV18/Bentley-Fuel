"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export default function Template({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex min-h-full flex-1 flex-col"
      initial={reduceMotion ? false : { opacity: 0.94, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
              y: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
            }
      }
    >
      {children}
    </motion.div>
  );
}
