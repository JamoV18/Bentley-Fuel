import type { CSSProperties } from "react";

/**
 * Recognizable campus photography for the four Bentley dining locations shown
 * in the Eat flow. These are visual references only; operational dining data
 * remains sourced separately.
 */
const LOCATION_IMAGES: Record<string, string> = {
  "loc-921": "https://www.bentley.edu/sites/default/files/2015/12/17/mag_body_student_center2_0.jpg",
  "loc-lacava": "https://commons.wikimedia.org/wiki/Special:Redirect/file/LaCava_-_Bentley_University_-_DSC00308.JPG?width=1400",
  "loc-market": "https://cdn.bentley.edu/sites/default/files/s3fs-public/inline-images/Collins.jpg?VersionId=jayaiAFddD07e8Moas6CZ3YvSkFGHjzQ",
  "loc-dana": "https://www.bentley.edu/sites/default/files/styles/media_image_tablet_webp/public/2026-03/updateddanacenter.jpeg.webp?itok=wCg8nUA2",
};

export default function LocationImage({
  locationId,
  name,
  className = "",
}: {
  locationId: string;
  name: string;
  className?: string;
}) {
  const source = LOCATION_IMAGES[locationId];
  const style: CSSProperties | undefined = source ? {
    backgroundImage: `linear-gradient(180deg, rgba(20,34,48,0) 58%, rgba(20,34,48,.18)), url("${source}")`,
  } : undefined;

  return (
    <div
      role="img"
      aria-label={`${name} location photo`}
      className={`meal-image meal-image-hero location-image ${className}`}
      style={style}
    />
  );
}
