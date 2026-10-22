"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  listProPlaceMemberships,
  type PlaceMemberRole,
} from "@/app/(pro)/dashboard-pro/lib/api/vendor";
import type { Place } from "@/lib/api/places";

export const CAFE_PARAM = "cafe";

/** Build a pro href that preserves the active `?cafe=` query. */
export function hrefWithCafe(href: string, cafeId: string | null | undefined): string {
  if (!cafeId) return href;
  const [path, existing] = href.split("?");
  const params = new URLSearchParams(existing ?? "");
  params.set(CAFE_PARAM, cafeId);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function placeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/**
 * Active café from `?cafe=<id>`, backed by `place_members`.
 */
export function useActivePlace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cafeParam = searchParams.get(CAFE_PARAM);

  const [places, setPlaces] = useState<Place[]>([]);
  const [roleByPlaceId, setRoleByPlaceId] = useState<Map<string, PlaceMemberRole>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listProPlaceMemberships()
      .then((rows) => {
        if (cancelled) return;
        setPlaces(rows.map((r) => r.place));
        setRoleByPlaceId(new Map(rows.map((r) => [r.place.id, r.role])));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const memberPlaceIds = useMemo(
    () => new Set(places.map((p) => p.id)),
    [places]
  );

  const cafeAccessDenied = useMemo(() => {
    if (loading || !cafeParam) return false;
    return !memberPlaceIds.has(cafeParam);
  }, [cafeParam, loading, memberPlaceIds]);

  const activePlace = useMemo(() => {
    if (places.length === 0) return null;
    if (cafeParam && memberPlaceIds.has(cafeParam)) {
      return places.find((p) => p.id === cafeParam) ?? places[0] ?? null;
    }
    return places[0] ?? null;
  }, [places, cafeParam, memberPlaceIds]);

  const activeMemberRole = useMemo(() => {
    if (!activePlace) return null;
    return roleByPlaceId.get(activePlace.id) ?? null;
  }, [activePlace, roleByPlaceId]);

  const activeIndex = useMemo(() => {
    if (!activePlace) return 0;
    const idx = places.findIndex((p) => p.id === activePlace.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [places, activePlace]);

  useEffect(() => {
    if (loading || cafeAccessDenied || !activePlace) return;
    if (cafeParam === activePlace.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(CAFE_PARAM, activePlace.id);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    loading,
    cafeAccessDenied,
    activePlace,
    cafeParam,
    pathname,
    router,
    searchParams,
  ]);

  const setActivePlaceId = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(CAFE_PARAM, id);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const withCafe = useCallback(
    (href: string) => hrefWithCafe(href, activePlace?.id ?? cafeParam),
    [activePlace?.id, cafeParam]
  );

  return {
    places,
    activePlace,
    activeMemberRole,
    activeIndex,
    total: places.length,
    loading,
    cafeAccessDenied,
    setActivePlaceId,
    withCafe,
    initialsFor: placeInitials,
  };
}
