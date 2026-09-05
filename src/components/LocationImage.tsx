import MealImage from "./MealImage";

/**
 * Recognizable Bentley campus imagery for the core dining locations. These
 * assets are served by Bentley University's public CDN and correspond to the
 * campus buildings students actually use. Unknown/retail-only locations fall
 * back to the existing food-photo system rather than inventing a building.
 */
const BENTLEY_LOCATION_IMAGES: Record<string, string> = {
  "loc-921": "https://cdn.bentley.edu/sites/default/files/s3fs-public/inline-images/Copy-of-student_center-20151006-CC5D5098.jpg?VersionId=pIVIjiB99JMKjNAVqbWHQI15aewnqalh",
  "loc-lacava": "https://cdn.bentley.edu/sites/default/files/s3fs-public/styles/media_image_tablet_webp/public/2024-01/lacavaedr_jan24-7_1.jpg.webp?VersionId=E0Bm4cHr7FxSwZzNl7RlfOerQU2vH1Ct&h=699f9664&itok=mJho8JDm",
  "loc-dana": "https://cdn.bentley.edu/sites/default/files/s3fs-public/styles/media_image_tablet_webp/public/2026-06/090223_fbweek1_73_1.jpg.webp?VersionId=DvIK69Tcxi8XbAevfkNi005QReJNoAgO&h=f7d9296c&itok=BsBIlV-7",
  "loc-market": "https://cdn.bentley.edu/sites/default/files/s3fs-public/inline-images/Collins.jpg?VersionId=jayaiAFddD07e8Moas6CZ3YvSkFGHjzQ",
};

export function locationImageUrl(locationId: string): string | undefined {
  return BENTLEY_LOCATION_IMAGES[locationId];
}

export default function LocationImage({
  id,
  name,
  className = "",
  aspect = "hero",
}: {
  id: string;
  name: string;
  className?: string;
  aspect?: "square" | "wide" | "hero";
}) {
  return <MealImage name={`${name} campus dining`} imageUrl={locationImageUrl(id)} className={className} aspect={aspect} />;
}
