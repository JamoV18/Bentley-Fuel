/**
 * The service-layer contract for reading dining data.
 *
 * The rest of the app (pages, recommendation engine, hooks) depends ONLY on this
 * interface — never on `data/mock` directly. Methods stay async so live campus
 * providers and local fallbacks share one contract.
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
  /** YYYY-MM-DD campus-local menu date for date-driven providers. */
  date?: string;
}

export interface DiningDataProvider {
  /** Broad provider status. Individual records still carry their own provenance. */
  readonly dataStatus: DataStatus;

  getUniversity(): Promise<University>;
  getLocations(): Promise<Location[]>;
  getLocation(id: LocationId): Promise<Location | undefined>;

  /** All stations, or only those in `locationId`; live providers may use `date`. */
  getStations(locationId?: LocationId, date?: string): Promise<Station[]>;
  getStation(id: StationId): Promise<Station | undefined>;

  getMenuItems(query?: MenuItemQuery): Promise<MenuItem[]>;
  getMenuItem(id: MenuItemId): Promise<MenuItem | undefined>;

  getComponents(ids?: FoodComponentId[]): Promise<FoodComponent[]>;
  getComponent(id: FoodComponentId): Promise<FoodComponent | undefined>;
}
