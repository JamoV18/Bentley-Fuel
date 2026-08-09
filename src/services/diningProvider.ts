/**
 * The service-layer contract for reading dining data.
 *
 * The rest of the app (pages, recommendation engine, hooks) depends ONLY on this
 * interface — never on `data/mock` directly. Today it's satisfied by an
 * in-memory mock; tomorrow a `ChartwellsDiningProvider` fetching a real API can
 * be dropped in with zero UI/engine changes.
 *
 * Methods are async (Promise-returning) so a real network-backed provider is a
 * pure swap, even though the mock resolves synchronously.
 */
import type {
  DataStatus,
  FoodComponent,
  FoodComponentId,
  Location,
  LocationId,
  MealPeriod,
  MenuItem,
  MenuItemId,
  MenuItemKind,
  Station,
  StationId,
  University,
} from "@/types";

/** Filters for `getMenuItems`. All fields are optional and AND-combined. */
export interface MenuItemQuery {
  locationId?: LocationId;
  stationId?: StationId;
  kind?: MenuItemKind;
  /** Matches items whose `availability` includes this period (or "all-day"). */
  mealPeriod?: MealPeriod;
}

export interface DiningDataProvider {
  /** Provenance status of everything this provider returns (e.g. "mock"). */
  readonly dataStatus: DataStatus;

  getUniversity(): Promise<University>;

  getLocations(): Promise<Location[]>;
  getLocation(id: LocationId): Promise<Location | undefined>;

  /** All stations, or only those in `locationId` when provided. */
  getStations(locationId?: LocationId): Promise<Station[]>;
  getStation(id: StationId): Promise<Station | undefined>;

  getMenuItems(query?: MenuItemQuery): Promise<MenuItem[]>;
  getMenuItem(id: MenuItemId): Promise<MenuItem | undefined>;

  /** All components, or only the requested IDs (order follows `ids`). */
  getComponents(ids?: FoodComponentId[]): Promise<FoodComponent[]>;
  getComponent(id: FoodComponentId): Promise<FoodComponent | undefined>;
}
