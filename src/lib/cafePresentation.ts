import type { Place } from "@/lib/api/places";
import type { PlaceOpenStatusRow } from "@/lib/api/openingHours";
import { cafeStatusFromOpenRow } from "@/lib/api/openingHours";
import {
  isPlaceOpenNow,
  normalizeKey,
} from "@/lib/filters";
import { isSpecPositive, sortSpecs, type PlaceSpec, type PlaceSpecMap, type SpecId } from "@/lib/specs";

export type CafeOpenStatus = "open" | "closing_soon" | "closed";

export function placeHasMatcha(place: Place): boolean {
  const hay = normalizeKey(
    `${place.name} ${place.description ?? ""} ${place.category ?? ""}`
  );
  return hay.includes("matcha") || hay.includes("chai") || !!place.is_vegan;
}

export function placeIsCalm(place: Place): boolean {
  const noise = normalizeKey(place.noise_level);
  return (
    !!place.categories?.includes("chill") ||
    noise === "quiet" ||
    noise.includes("calme") ||
    noise.includes("quiet") ||
    noise.includes("chill")
  );
}

export type CafeFeatureId = "wifi" | "matcha" | "calme" | "activites";

const FEATURE_BY_SPEC: Partial<Record<SpecId, CafeFeatureId>> = {
  wifi: "wifi",
  matcha: "matcha",
  calm: "calme",
  events: "activites",
};

/** Features backed by the café pulse, best confirmed first. */
function featureIdsFromSpecs(specs: PlaceSpecMap): CafeFeatureId[] {
  const positive = sortSpecs(
    Object.values(specs).filter((s): s is PlaceSpec => isSpecPositive(s))
  );
  const ids: CafeFeatureId[] = [];
  for (const s of positive) {
    const id = FEATURE_BY_SPEC[s.spec];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Feature tags of a café. With `specs` (the café pulse), only what the café
 * announced or the community confirmed; without, a guess from its columns.
 */
export function cafeFeatureIds(place: Place, specs?: PlaceSpecMap): CafeFeatureId[] {
  if (specs) return featureIdsFromSpecs(specs).slice(0, 3);
  const ids: CafeFeatureId[] = [];
  if (place.wifi_speed || place.has_plugs || place.laptop_policy) {
    ids.push("wifi");
  }
  if (placeHasMatcha(place)) ids.push("matcha");
  if (placeIsCalm(place) || place.has_terrace) ids.push("calme");
  if (place.categories?.includes("event") || place.categories?.includes("sport")) {
    ids.push("activites");
  }
  return ids.slice(0, 3);
}

export function cafeOpenStatus(
  place: Place,
  openRow?: PlaceOpenStatusRow | null
): {
  status: CafeOpenStatus;
  statusDetail?: string;
} {
  const fromRpc = cafeStatusFromOpenRow(openRow);
  if (fromRpc) return fromRpc;

  const open = isPlaceOpenNow(place);
  return {
    status: open ? "open" : "closed",
    statusDetail: place.opening_hours?.trim() || undefined,
  };
}

export type PinKind = "wifi" | "matcha" | "calme" | "activites" | "coffee";

export function pinKindFor(place: Place, specs?: PlaceSpecMap): PinKind {
  if (specs) return featureIdsFromSpecs(specs)[0] ?? "coffee";
  if (place.wifi_speed || place.laptop_policy) return "wifi";
  if (placeHasMatcha(place)) return "matcha";
  if (placeIsCalm(place)) return "calme";
  if (place.categories?.includes("event")) return "activites";
  return "coffee";
}
