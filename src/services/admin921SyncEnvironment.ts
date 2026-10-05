export interface Admin921Environment {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

/**
 * Local development can exercise publishing against its process-local fallback.
 * A deployed production build must be the Vercel production environment so a
 * trusted snapshot is written to the same Runtime Cache environment students use.
 */
export function canPublish921Snapshot(environment: Admin921Environment = process.env): boolean {
  return environment.NODE_ENV !== "production" || environment.VERCEL_ENV === "production";
}
