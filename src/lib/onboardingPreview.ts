export function isOnboardingPreviewMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}
