import { foodArtImageUrl } from "@/lib/foodArtIdentity";
import type { MenuItem } from "@/types";
import { foodArtSourceFingerprint } from "./fingerprint";

export function attachFoodArtResolverUrls(items: MenuItem[]): MenuItem[] {
  return items.map((item) => ({
    ...item,
    // This is not an upstream photo. It is a stable resolver for the exact
    // DineOnCampus recipe fingerprint represented by this MenuItem snapshot.
    imageUrl: foodArtImageUrl(item.name, foodArtSourceFingerprint(item)),
  }));
}
