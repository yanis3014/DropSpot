import { normalizeKey } from "@/lib/filters";

/** Shared map/list amenity chips (+ favorites on list). */
export const PLACE_FILTER_IDS = [
  "wifi",
  "matcha",
  "calme",
  "open_now",
  "favorites",
] as const;

export type PlaceFilterId = (typeof PLACE_FILTER_IDS)[number];

/** Amenity chips shared by map and list (excludes favorites). */
export const AMENITY_FILTER_IDS = [
  "wifi",
  "matcha",
  "calme",
  "open_now",
] as const satisfies readonly PlaceFilterId[];

export type AmenityFilterId = (typeof AMENITY_FILTER_IDS)[number];

export const FILTERS_PARAM = "filters";

const FILTER_ID_SET = new Set<string>(PLACE_FILTER_IDS);

/** Map legacy onboarding `?filter=` values onto chip ids. */
export function normalizeLegacyFilter(
  raw: string | null | undefined
): PlaceFilterId | null {
  if (!raw) return null;
  const key = normalizeKey(raw);
  if (FILTER_ID_SET.has(key)) return key as PlaceFilterId;
  if (key === "plugs" || key === "remote") return "wifi";
  if (key === "chill" || key === "ambiance" || key === "terrace") return "calme";
  if (key === "open" || key === "ouvert") return "open_now";
  if (key === "favoris" || key === "saved" || key === "favorites")
    return "favorites";
  return null;
}

export function parseFiltersParam(
  searchParams: URLSearchParams
): PlaceFilterId[] {
  const multi = searchParams.getAll(FILTERS_PARAM);
  const rawParts =
    multi.length > 0
      ? multi.flatMap((v) => v.split(","))
      : [];

  // Legacy single `filter=`
  const legacy = normalizeLegacyFilter(searchParams.get("filter"));
  const fromLegacy = legacy ? [legacy] : [];

  const seen = new Set<PlaceFilterId>();
  const out: PlaceFilterId[] = [];
  for (const part of [...rawParts.map(normalizeKey), ...fromLegacy]) {
    if (!FILTER_ID_SET.has(part)) continue;
    const id = part as PlaceFilterId;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function serializeFiltersParam(filters: readonly PlaceFilterId[]): string {
  return filters.join(",");
}

/** Build `?filters=…` (or empty) for Link hrefs. */
export function filtersQueryString(
  filters: readonly PlaceFilterId[]
): string {
  if (filters.length === 0) return "";
  return `?${FILTERS_PARAM}=${encodeURIComponent(serializeFiltersParam(filters))}`;
}

/** Write filters into a URLSearchParams copy (drops legacy `filter`). */
export function applyFiltersToSearchParams(
  current: URLSearchParams,
  filters: readonly PlaceFilterId[]
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  next.delete("filter");
  next.delete(FILTERS_PARAM);
  if (filters.length > 0) {
    next.set(FILTERS_PARAM, serializeFiltersParam(filters));
  }
  return next;
}
