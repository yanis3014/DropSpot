import type { Place } from "@/lib/api/places";
import {
  isPlaceOpenNow,
  normalizeKey,
} from "@/lib/filters";

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

export function cafeFeatureIds(place: Place): CafeFeatureId[] {
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

export function cafeOpenStatus(place: Place): {
  status: CafeOpenStatus;
  statusDetail?: string;
} {
  const open = isPlaceOpenNow(place);
  return {
    status: open ? "open" : "closed",
    statusDetail: place.opening_hours?.trim() || undefined,
  };
}

export type PinKind = "wifi" | "matcha" | "calme" | "activites" | "coffee";

export function pinKindFor(place: Place): PinKind {
  if (place.wifi_speed || place.laptop_policy) return "wifi";
  if (placeHasMatcha(place)) return "matcha";
  if (placeIsCalm(place)) return "calme";
  if (place.categories?.includes("event")) return "activites";
  return "coffee";
}
