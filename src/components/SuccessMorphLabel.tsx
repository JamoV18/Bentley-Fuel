"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export default function SuccessMorphLabel({
  success,
  idleLabel,
  successLabel,
}: {
  success: boolean;
  idleLabel: string;
  successLabel: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <span className="inline-grid min-w-[5.6rem] place-items-center">
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={success ? "success" : "idle"}
          className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap"
          initial={reduceMotion ? false : { opacity: 0, y: success ? 4 : -3, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: success ? -3 : 3, scale: 0.98 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {success && (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <motion.path
                d="M4.5 10.2 8.1 13.6 15.6 6.4"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduceMotion ? false : { pathLength: 0, opacity: 0.5 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          )}
          <span>{success ? successLabel : idleLabel}</span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
