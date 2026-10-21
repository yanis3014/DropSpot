"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  applyFiltersToSearchParams,
  parseFiltersParam,
  type PlaceFilterId,
} from "@/lib/mapFilters";

/** Shared map/list filter state backed by `?filters=` in the URL. */
export function usePlaceFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFiltersParam(searchParams),
    [searchParams]
  );

  const setFilters = useCallback(
    (
      next:
        | PlaceFilterId[]
        | ((prev: PlaceFilterId[]) => PlaceFilterId[])
    ) => {
      const resolved = typeof next === "function" ? next(filters) : next;
      const params = applyFiltersToSearchParams(searchParams, resolved);
      const qs = params.toString();
      // Native history update: Next syncs useSearchParams without a server
      // round trip, so a chip tap applies instantly (router.replace refetched
      // the page through the proxy on every tap).
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [filters, pathname, searchParams]
  );

  const toggleFilter = useCallback(
    (id: PlaceFilterId) => {
      setFilters((prev) =>
        prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
      );
    },
    [setFilters]
  );

  return { filters, setFilters, toggleFilter };
}
