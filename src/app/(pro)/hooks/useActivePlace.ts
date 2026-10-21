"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getProAccessiblePlaces } from "@/app/(pro)/dashboard-pro/lib/api/vendor";
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
 * Active vendor place from `?cafe=<id>`, backed by `getVendorPlaces`.
 * Syncs the URL when the param is missing or invalid.
 */
export function useActivePlace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cafeParam = searchParams.get(CAFE_PARAM);

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProAccessiblePlaces()
      .then((rows) => {
        if (!cancelled) setPlaces(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activePlace = useMemo(() => {
    if (places.length === 0) return null;
    if (cafeParam) {
      const match = places.find((p) => p.id === cafeParam);
      if (match) return match;
    }
    return places[0] ?? null;
  }, [places, cafeParam]);

  const activeIndex = useMemo(() => {
    if (!activePlace) return 0;
    const idx = places.findIndex((p) => p.id === activePlace.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [places, activePlace]);

  useEffect(() => {
    if (loading || !activePlace) return;
    if (cafeParam === activePlace.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(CAFE_PARAM, activePlace.id);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [loading, activePlace, cafeParam, pathname, router, searchParams]);

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
    activeIndex,
    total: places.length,
    loading,
    setActivePlaceId,
    withCafe,
    initialsFor: placeInitials,
  };
}
