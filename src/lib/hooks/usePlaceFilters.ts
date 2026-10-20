"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyFiltersToSearchParams,
  parseFiltersParam,
  type PlaceFilterId,
} from "@/lib/mapFilters";

/** Shared map/list filter state backed by `?filters=` in the URL. */
export function usePlaceFilters() {
  const router = useRouter();
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
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router, searchParams]
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
