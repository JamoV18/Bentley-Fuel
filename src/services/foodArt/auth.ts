import { timingSafeEqual } from "node:crypto";
import { readFoodArtConfig } from "./config";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAuthorizedFoodArtRequest(request: Request): boolean {
  const secret = readFoodArtConfig().cronSecret;
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-falcon-art-secret")?.trim() ?? "";
  return safeEqual(bearer || headerSecret, secret);
}
