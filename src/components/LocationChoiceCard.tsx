import Link from "next/link";

export default function LocationChoiceCard({ id, name, shortName, building, description, stationCount }: {
  id: string; name: string; shortName?: string; building?: string; description?: string; stationCount: number;
}) {
  return <Link href={`/locations/${id}`} className="ff-location-choice">
    <div><h2>{shortName ?? name}</h2>{building && <p>{building}</p>}</div>
    {description && <p>{description}</p>}
    <span className="ff-location-choice-foot">{stationCount} {stationCount === 1 ? "station" : "stations"}<span aria-hidden="true">→</span></span>
  </Link>;
}
