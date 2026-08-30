from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"patch target missing in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


provider = "src/services/dineOnCampusProvider.ts"
server = "src/services/dineOnCampusServerFetch.ts"

replace_once(
    provider,
    'import { bentleyMenuDate } from "@/lib/bentleyDiningDate";\n',
    'import { bentleyMenuDate } from "@/lib/bentleyDiningDate";\nimport { BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID } from "./dineOnCampusServerFetch";\n',
)

replace_once(
    provider,
    '''function extractCategories(payload: unknown): JsonRecord[] {\n  const root = record(payload);\n  const direct = records(record(root.period).categories);\n  if (direct.length > 0) return direct;\n\n  const menu = record(root.menu);\n  const periods = menu.periods;\n  if (Array.isArray(periods)) return periods.flatMap((entry) => records(record(entry).categories));\n  const nested = records(record(periods).categories);\n  if (nested.length > 0) return nested;\n  return records(root.categories);\n}\n''',
    '''function categoryItems(category: JsonRecord): JsonRecord[] {\n  return records(category.items ?? category.menuItems ?? category.menu_items ?? category.products);\n}\n\nfunction extractCategories(payload: unknown): JsonRecord[] {\n  const queue: unknown[] = [payload];\n  const seen = new Set<unknown>();\n  let fallback: JsonRecord[] = [];\n\n  while (queue.length > 0) {\n    const value = queue.shift();\n    if (!value || seen.has(value)) continue;\n    if (typeof value === "object") seen.add(value);\n\n    if (Array.isArray(value)) {\n      queue.push(...value);\n      continue;\n    }\n\n    const current = record(value);\n    const categories = records(current.categories);\n    if (categories.length > 0) {\n      if (categories.some((category) => categoryItems(category).length > 0)) return categories;\n      if (fallback.length === 0) fallback = categories;\n    }\n\n    for (const key of ["data", "result", "location", "menu", "period", "periods"]) {\n      if (current[key] !== undefined) queue.push(current[key]);\n    }\n  }\n\n  return fallback;\n}\n''',
)

replace_once(
    provider,
    '''function periodsFromPayload(payload: unknown): JsonRecord[] {\n  const root = record(payload);\n  const candidates = records(root.periods);\n  return candidates.length > 0 ? candidates : records(root.data);\n}\n''',
    '''function periodsFromPayload(payload: unknown): JsonRecord[] {\n  const root = record(payload);\n  const candidates = [\n    ...records(root.periods),\n    ...records(root.data),\n    ...records(record(root.data).periods),\n    ...records(record(root.location).periods),\n    ...records(record(root.menu).periods),\n    ...records(record(root.result).periods),\n  ];\n  const seen = new Set<string>();\n  return candidates.filter((period) => {\n    const key = `${text(period.id ?? period.periodId ?? period.period_id ?? period._id)}::${normalized(text(period.name ?? period.label ?? period.displayName ?? period.period_name))}`;\n    if (!key || key === "::" || seen.has(key)) return false;\n    seen.add(key);\n    return true;\n  });\n}\n''',
)

replace_once(provider, 'const richerItems = new Map(records(richerCategory.items).map((item) => [itemKey(stationName, item), item] as const));', 'const richerItems = new Map(categoryItems(richerCategory).map((item) => [itemKey(stationName, item), item] as const));')
replace_once(provider, 'const items = records(category.items).map((item) => {', 'const items = categoryItems(category).map((item) => {')
replace_once(provider, 'for (const richItem of records(richerCategory.items)) {', 'for (const richItem of categoryItems(richerCategory)) {')
replace_once(provider, 'const categoryItems = records(category.items);\n        categoryItems.forEach((rawItem, index) => {', 'const publishedItems = categoryItems(category);\n        publishedItems.forEach((rawItem, index) => {')

replace_once(
    provider,
    '''  const add = (period: JsonRecord, version: "v4" | "v1") => {\n    const name = text(period.name ?? period.label);\n    if (!name) return;\n    const key = normalized(name);\n    const id = text(period.id ?? period.periodId ?? period.period_id);\n''',
    '''  const add = (period: JsonRecord, version: "v4" | "v1") => {\n    const name = text(period.name ?? period.label ?? period.displayName ?? period.period_name);\n    if (!name) return;\n    const key = normalized(name);\n    const id = text(period.id ?? period.periodId ?? period.period_id ?? period._id);\n''',
)

replace_once(
    provider,
    '''    const request = this.loadLiveDate(date).then((result) => {\n      if (!result) this.liveDateCache.delete(date);\n      return result;\n    });\n''',
    '''    const request = this.loadLiveDate(date).then((result) => {\n      if (!result) {\n        this.liveDateCache.delete(date);\n        // Discovery can become stale across a DineOnCampus publishing rollover.\n        // Let the next request rediscover The 921 instead of caching a dead ID.\n        this.dineOnCampusLocationIdPromise = undefined;\n      }\n      return result;\n    });\n''',
)

replace_once(
    provider,
    '''  private resolveDineOnCampusLocationId(): Promise<string | undefined> {\n    if (this.dineOnCampusLocationIdPromise) return this.dineOnCampusLocationIdPromise;\n    this.dineOnCampusLocationIdPromise = (async () => {\n      const sitesPayload = await fetchJson(SITES_URL);\n      const bentley = siteRows(sitesPayload).find((site) => normalized(text(site.name)).includes("bentley"));\n      const siteId = text(bentley?.id ?? bentley?.siteId ?? bentley?.site_id ?? bentley?._id);\n      if (!siteId) return undefined;\n\n      const locationsPayload = await fetchJson(LOCATIONS_URL(siteId));\n      const locations = locationRows(locationsPayload);\n      const nineTwentyOne = locations.find((location) => normalized(text(location.name)).includes("921"));\n      return text(nineTwentyOne?.id ?? nineTwentyOne?.locationId ?? nineTwentyOne?.location_id ?? nineTwentyOne?._id) || undefined;\n    })();\n    return this.dineOnCampusLocationIdPromise;\n  }\n\n  private async loadLiveDate(date: string): Promise<LiveDateData | undefined> {\n    const locationId = await this.resolveDineOnCampusLocationId();\n    if (!locationId) return undefined;\n''',
    '''  private resolveDineOnCampusLocationId(): Promise<string | undefined> {\n    if (this.dineOnCampusLocationIdPromise) return this.dineOnCampusLocationIdPromise;\n    this.dineOnCampusLocationIdPromise = (async () => {\n      const sitesPayload = await fetchJson(SITES_URL);\n      const bentley = siteRows(sitesPayload).find((site) =>\n        normalized(text(site.name ?? site.label ?? site.universityName)).includes("bentley"),\n      );\n      const siteId = text(bentley?.id ?? bentley?.siteId ?? bentley?.site_id ?? bentley?._id);\n      if (!siteId) return BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;\n\n      const locationsPayload = await fetchJson(LOCATIONS_URL(siteId));\n      const locations = locationRows(locationsPayload);\n      const nineTwentyOne = locations.find((location) => {\n        const label = normalized(text(\n          location.name ?? location.label ?? location.displayName ?? location.buildingName ?? location.locationName,\n        ));\n        return label.includes("921") || label.includes("nine twenty one");\n      });\n      return text(nineTwentyOne?.id ?? nineTwentyOne?.locationId ?? nineTwentyOne?.location_id ?? nineTwentyOne?._id)\n        || BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;\n    })();\n    return this.dineOnCampusLocationIdPromise;\n  }\n\n  private async loadLiveDate(date: string, forcedLocationId?: string): Promise<LiveDateData | undefined> {\n    const locationId = forcedLocationId\n      ?? await this.resolveDineOnCampusLocationId()\n      ?? BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;\n''',
)

replace_once(
    provider,
    '''    const periods = describePeriods(v4Periods, v1Periods);\n    if (periods.length === 0) return undefined;\n''',
    '''    const periods = describePeriods(v4Periods, v1Periods);\n    if (periods.length === 0) {\n      if (!forcedLocationId && locationId !== BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID) {\n        return this.loadLiveDate(date, BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID);\n      }\n      return undefined;\n    }\n''',
)

replace_once(provider, 'const mealPeriod = periodFromName(period.name);\n      if (!mealPeriod) return undefined;', 'const mealPeriod = periodFromName(period.name) ?? "all-day";')

replace_once(
    provider,
    '''    const items = [...itemMap.values()];\n    if (items.length === 0) return undefined;\n    return { stations: [...stationMap.values()], items };\n''',
    '''    const items = [...itemMap.values()];\n    if (items.length === 0) {\n      if (!forcedLocationId && locationId !== BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID) {\n        return this.loadLiveDate(date, BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID);\n      }\n      return undefined;\n    }\n    return { stations: [...stationMap.values()], items };\n''',
)

server_path = Path(server)
text = server_path.read_text()
text = text.replace('const BENTLEY_DISCOVERY_SITE_ID = "bentley-fuel-fixed-site";\n', '')
start = text.find('    // Avoid brittle legacy school/location discovery.')
end = text.find('    const headers = new Headers', start)
if start < 0 or end < 0:
    raise SystemExit('server discovery interception block not found')
text = text[:start] + '    // Discovery requests now pass through too. The provider treats the pinned ID\n    // as a fallback rather than pretending it is permanently current.\n\n' + text[end:]
text = text.replace('Chrome/139.0 Safari/537.36', 'Chrome/144.0 Safari/537.36')
server_path.write_text(text)
