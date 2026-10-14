import PageHeader from "@/components/PageHeader";
import AppNav from "@/components/AppNav";
import FirstRunDiningChoice from "@/components/FirstRunDiningChoice";
import LocationChoiceCard from "@/components/LocationChoiceCard";
import { getDiningProvider } from "@/services";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const provider = getDiningProvider();
  const locations = await provider.getLocations();
  const cards = await Promise.all(locations.map(async (location) => ({
    location,
    stationCount: (await provider.getStations(location.id)).length,
  })));

  return (
    <>
      <FirstRunDiningChoice locations={locations.map((location) => ({ id: location.id, name: location.name, shortName: location.shortName, building: location.building }))} />
      <main className="ff-page">
        <PageHeader title="Choose a location" />

        <AppNav />
        {provider.dataStatus === "mock" && (
          <p className="mt-3 border-l-2 border-[var(--ff-warning)] pl-3 text-xs text-[var(--ff-warning)]">
            Live DineOnCampus integration is enabled for the 921. Other campus locations still contain demo menu data until their official sources are connected.
          </p>
        )}
        <div className="ff-location-list">
          {cards.map(({ location, stationCount }) => (
            <LocationChoiceCard
              key={location.id}
              id={location.id}
              name={location.name}
              shortName={location.shortName}
              building={location.building}
              description={location.description}
              stationCount={stationCount}
            />
          ))}
        </div>
      </main>
    </>
  );
}
