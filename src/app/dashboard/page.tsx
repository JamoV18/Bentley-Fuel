import PageHeader from "@/components/PageHeader";
import AppNav from "@/components/AppNav";
import FirstRunDiningChoice from "@/components/FirstRunDiningChoice";
import LocationChoiceCard from "@/components/LocationChoiceCard";
import { getDiningProvider } from "@/services";

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
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
        <PageHeader title="Choose a location" />

        <AppNav />
        {provider.dataStatus === "mock" && (
          <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            Live DineOnCampus integration is enabled for the 921. Other campus locations still contain demo menu data until their official sources are connected.
          </p>
        )}
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
