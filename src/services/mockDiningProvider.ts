/**
 * In-memory implementation of `DiningDataProvider` backed by the mock dataset.
 * Builds ID indexes once for O(1) lookups.
 */
import type {
  DataStatus,
  DiningDataset,
  FoodComponent,
  FoodComponentId,
  Location,
  LocationId,
  MenuItem,
  MenuItemId,
  Station,
  StationId,
  University,
} from "@/types";
import { mockDiningDataset } from "@/data/mock";
import type { DiningDataProvider, MenuItemQuery } from "./diningProvider";

export class MockDiningProvider implements DiningDataProvider {
  readonly dataStatus: DataStatus = "mock";

  private readonly data: DiningDataset;
  private readonly locationIndex: Map<LocationId, Location>;
  private readonly stationIndex: Map<StationId, Station>;
  private readonly itemIndex: Map<MenuItemId, MenuItem>;
  private readonly componentIndex: Map<FoodComponentId, FoodComponent>;

  constructor(data: DiningDataset = mockDiningDataset) {
    this.data = data;
    this.locationIndex = new Map(data.locations.map((l) => [l.id, l]));
    this.stationIndex = new Map(data.stations.map((s) => [s.id, s]));
    this.itemIndex = new Map(data.menuItems.map((i) => [i.id, i]));
    this.componentIndex = new Map(data.components.map((c) => [c.id, c]));
  }

  async getUniversity(): Promise<University> { return this.data.university; }
  async getLocations(): Promise<Location[]> { return this.data.locations; }
  async getLocation(id: LocationId): Promise<Location | undefined> { return this.locationIndex.get(id); }

  async getStations(locationId?: LocationId, _date?: string): Promise<Station[]> {
    if (!locationId) return this.data.stations;
    return this.data.stations.filter((s) => s.locationId === locationId);
  }

  async getStation(id: StationId): Promise<Station | undefined> { return this.stationIndex.get(id); }

  async getMenuItems(query: MenuItemQuery = {}): Promise<MenuItem[]> {
    const { locationId, stationId, kind, mealPeriod } = query;
    return this.data.menuItems.filter((item) => {
      if (locationId && item.locationId !== locationId) return false;
      if (stationId && item.stationId !== stationId) return false;
      if (kind && item.kind !== kind) return false;
      if (mealPeriod) {
        const periods = item.availability ?? ["all-day"];
        if (!periods.includes(mealPeriod) && !periods.includes("all-day")) return false;
      }
      return true;
    });
  }

  async getMenuItem(id: MenuItemId): Promise<MenuItem | undefined> { return this.itemIndex.get(id); }

  async getComponents(ids?: FoodComponentId[]): Promise<FoodComponent[]> {
    if (!ids) return this.data.components;
    return ids.map((id) => this.componentIndex.get(id)).filter((c): c is FoodComponent => Boolean(c));
  }

  async getComponent(id: FoodComponentId): Promise<FoodComponent | undefined> { return this.componentIndex.get(id); }
}
