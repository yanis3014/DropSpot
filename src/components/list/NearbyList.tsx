"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarBlank,
  Check,
  Clock,
  Heart,
  Leaf,
  MagnifyingGlass,
  MapTrifold,
  Moon,
  WifiHigh,
} from "@phosphor-icons/react";
import { getPlaces, type Place } from "@/lib/api/places";
import { getSavedPlaceIds } from "@/lib/api/saved";
import { peekCache } from "@/lib/cache/clientCache";
import {
  cafeFeatureIds,
  cafeOpenStatus,
  type CafeFeatureId,
} from "@/lib/cafePresentation";
import { hasValidCoordinates, placeMatchesFilters } from "@/lib/filters";
import {
  distanceMeters,
  formatDistance,
  getCurrentPosition,
  type LatLng,
} from "@/lib/geo";
import { useAuth } from "@/lib/hooks/useAuth";
import { usePlaceFilters } from "@/lib/hooks/usePlaceFilters";
import { usePlacesOpenStatus } from "@/hooks/usePlacesOpenStatus";
import {
  AMENITY_FILTER_IDS,
  filtersQueryString,
  type AmenityFilterId,
  type PlaceFilterId,
} from "@/lib/mapFilters";
import CafeRow, { type CafeRowFeature } from "@/components/ui/CafeRow";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

const NEARBY_RADIUS_M = 1000;

const LIST_CHIPS: {
  id: PlaceFilterId;
  label: string;
  Icon: typeof WifiHigh;
}[] = [
  { id: "open_now", label: "Ouvert maintenant", Icon: Clock },
  { id: "wifi", label: "Wi-Fi", Icon: WifiHigh },
  { id: "matcha", label: "Matcha", Icon: Leaf },
  { id: "calme", label: "Calme", Icon: Moon },
  { id: "favorites", label: "Favoris", Icon: Heart },
];

const FEATURE_ICONS: Record<CafeFeatureId, ReactNode> = {
  wifi: <WifiHigh size={15} weight="regular" />,
  matcha: <Leaf size={15} weight="regular" />,
  calme: <Moon size={15} weight="regular" />,
  activites: <CalendarBlank size={15} weight="regular" />,
};

const FEATURE_LABELS: Record<CafeFeatureId, string> = {
  wifi: "Wi-Fi",
  matcha: "Matcha",
  calme: "Calme",
  activites: "Activités",
};

function cafeFeatures(place: Place): CafeRowFeature[] {
  return cafeFeatureIds(place).map((id) => ({
    icon: FEATURE_ICONS[id],
    label: FEATURE_LABELS[id],
  }));
}

type PlaceWithDistance = Place & { distanceM: number | null };

export default function NearbyList() {
  const { isAuthenticated } = useAuth();
  const { filters, toggleFilter, setFilters } = usePlaceFilters();

  const [places, setPlaces] = useState<Place[]>(
    () => peekCache<Place[]>("places:full") ?? []
  );
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(() => !peekCache("places:full"));

  const amenityFilters = useMemo(
    () =>
      filters.filter((f): f is AmenityFilterId =>
        (AMENITY_FILTER_IDS as readonly string[]).includes(f)
      ),
    [filters]
  );
  const favoritesOnly = filters.includes("favorites");
  const mapHref = `/map${filtersQueryString(filters)}`;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!peekCache("places:full")) setLoading(true);
        const data = await getPlaces({ withCoordinatesOnly: true });
        if (!cancelled) setPlaces(data);
      } catch (err) {
        console.error("Error fetching places:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getCurrentPosition().then((result) => {
      if (!cancelled && result.ok) setUserCoords(result.coords);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getSavedPlaceIds()
      .then((ids) => {
        if (!cancelled) setSavedIds(ids);
      })
      .catch((err) => console.error("Error fetching saved places:", err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const ranked = useMemo(() => {
    const effectiveSavedIds = isAuthenticated ? savedIds : [];
    const rows: PlaceWithDistance[] = places
      .filter((p) => hasValidCoordinates(p))
      .filter((p) => placeMatchesFilters(p, amenityFilters))
      .filter((p) => !favoritesOnly || effectiveSavedIds.includes(p.id))
      .map((p) => ({
        ...p,
        distanceM: userCoords
          ? distanceMeters(userCoords, { lat: p.lat, lng: p.lng })
          : null,
      }));

    rows.sort((a, b) => {
      if (a.distanceM == null && b.distanceM == null) {
        return a.name.localeCompare(b.name, "fr");
      }
      if (a.distanceM == null) return 1;
      if (b.distanceM == null) return -1;
      return a.distanceM - b.distanceM;
    });

    return rows;
  }, [
    places,
    amenityFilters,
    favoritesOnly,
    isAuthenticated,
    savedIds,
    userCoords,
  ]);

  const rankedIds = useMemo(() => ranked.map((p) => p.id), [ranked]);
  const openStatusByPlace = usePlacesOpenStatus(rankedIds);

  const within1km = useMemo(
    () =>
      ranked.filter(
        (p) => p.distanceM != null && p.distanceM <= NEARBY_RADIUS_M
      ).length,
    [ranked]
  );

  const counterLabel = userCoords
    ? `${within1km} café${within1km === 1 ? "" : "s"} à moins de 1 km`
    : loading
      ? "Chargement…"
      : `${ranked.length} café${ranked.length === 1 ? "" : "s"}`;

  return (
    <main className="flex flex-1 flex-col bg-ds-bg pb-28">
      <div className="flex items-center justify-between px-5 pb-3.5 pt-8">
        <h1 className="font-display text-[34px] font-extrabold leading-tight text-ds-text">
          À proximité
        </h1>
        <Link
          href={mapHref}
          className="inline-flex h-11 items-center gap-1.5 px-1 text-[15px] font-bold text-ds-accent no-underline"
        >
          <MapTrifold size={20} weight="regular" aria-hidden />
          Carte
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-1 pt-3.5">
        {LIST_CHIPS.map(({ id, label, Icon }) => {
          const active = filters.includes(id);
          return (
            <Chip
              key={id}
              active={active}
              icon={
                active ? (
                  <Check size={16} weight="regular" aria-hidden />
                ) : (
                  <Icon size={16} weight="regular" aria-hidden />
                )
              }
              onClick={() => toggleFilter(id)}
            >
              {label}
            </Chip>
          );
        })}
        <div className="w-2 shrink-0" aria-hidden />
      </div>

      <div className="flex items-center justify-between px-5 pb-2 pt-2.5">
        <span className="text-sm text-ds-text2">{counterLabel}</span>
        <span className="inline-flex h-11 items-center gap-1.5 text-[15px] font-bold text-ds-text">
          Distance
        </span>
      </div>

      <div className="flex flex-col gap-2.5 px-4">
        {loading && ranked.length === 0 ? (
          <p className="py-10 text-center text-sm text-ds-text2">
            Chargement des cafés…
          </p>
        ) : ranked.length === 0 && favoritesOnly && !isAuthenticated ? (
          <p className="py-10 text-center text-sm text-ds-text2">
            Connecte-toi pour voir tes favoris.
          </p>
        ) : ranked.length === 0 && filters.length > 0 ? (
          <EmptyState
            icon={<MagnifyingGlass weight="regular" />}
            title="Aucun café ne coche tout"
            description="Retire un filtre pour élargir la recherche."
            actionLabel="Effacer les filtres"
            onAction={() => setFilters([])}
            className="px-4 pt-[7.5rem]"
          />
        ) : ranked.length === 0 ? (
          <p className="py-10 text-center text-sm text-ds-text2">
            Aucun café à proximité pour l&apos;instant.
          </p>
        ) : (
          ranked.map((place) => {
            const meta = cafeOpenStatus(place, openStatusByPlace[place.id]);
            return (
              <CafeRow
                key={place.id}
                name={place.name}
                rating="—"
                status={meta.status}
                statusDetail={meta.statusDetail}
                distance={
                  place.distanceM != null
                    ? formatDistance(place.distanceM)
                    : "—"
                }
                features={cafeFeatures(place)}
                imageSrc={place.image_url}
                href={`/place/${place.id}`}
                className={cn("max-w-none")}
              />
            );
          })
        )}
      </div>
    </main>
  );
}
