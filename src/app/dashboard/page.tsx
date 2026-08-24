import Link from "next/link";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import { getDiningProvider } from "@/services";

export default async function DashboardPage() {
  const provider = getDiningProvider();
  const locations = await provider.getLocations();
  const cards = await Promise.all(locations.map(async (location) => ({
    location,
    stationCount: (await provider.getStations(location.id)).length,
  })));

  return (
    <main className="app-screen eat-screen" data-app-screen="true">
      <header className="native-header">
        <p className="brand-kicker">Falcon Fuel</p>
        <h1 className="native-title">Eat</h1>
        <p className="native-subtitle">Where are you eating? Pick the place first, then Falcon Fuel finds the best option there for your plan.</p>
      </header>

      {provider.dataStatus === "mock" && (
        <p className="eat-demo-note">Demo menu data · not current official Bentley Dining information.</p>
      )}

      <section className="location-stack" aria-label="Dining locations">
        {cards.map(({ location, stationCount }) => (
          <Link key={location.id} href={`/locations/${location.id}`} className="location-card">
            <MealImage name={`${location.name} healthy food`} aspect="hero" />
            <div className="location-card-content">
              <div className="min-w-0">
                <p className="location-card-kicker">Dining location</p>
                <h2>{location.shortName ?? location.name}</h2>
                {location.building && <p>{location.building}</p>}
                <p className="location-card-meta">{stationCount} {stationCount === 1 ? "dining concept" : "dining concepts"}</p>
              </div>
              <span className="location-card-arrow">→</span>
            </div>
          </Link>
        ))}
      </section>

      <AppNav />
    </main>
  );
}
