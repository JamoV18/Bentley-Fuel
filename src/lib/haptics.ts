/**
 * Tiny progressive enhancement for supported mobile browsers. Haptics never
 * carry information and silently no-op when unavailable or reduced-motion is set.
 */
export function softSuccessHaptic(): void {
  if (typeof window === "undefined" || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  navigator.vibrate(18);
}
