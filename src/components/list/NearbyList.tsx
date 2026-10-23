"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarBlank,
  Check,
  Clock,
  Heart,
  Leaf,
  MagnifyingGlass,
  Moon,
  Plus,
  Storefront,
  Trophy,
  WifiHigh,
} from "@phosphor-icons/react";
import Link from "next/link";
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
import { usePlacePulse } from "@/lib/hooks/usePlacePulse";
import { getMyProfile } from "@/lib/api/profiles";
import type { OnboardingAnswers } from "@/lib/onboarding";
import { readLocalOnboarding } from "@/lib/onboardingStorage";
import {
  FILTER_SPECS,
  PLACE_SORTS,
  sortPlaces,
  specsForAnswers,
  type PlaceSortId,
} from "@/lib/placeRanking";
import type { PlaceSpecMap, SpecId } from "@/lib/specs";
import {
  AMENITY_FILTER_IDS,
  type AmenityFilterId,
  type PlaceFilterId,
} from "@/lib/mapFilters";
import CafeRow, { type CafeRowFeature } from "@/components/ui/CafeRow";
import SuggestPlaceSheet from "@/components/list/SuggestPlaceSheet";
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

function cafeFeatures(place: Place, specs: PlaceSpecMap): CafeRowFeature[] {
  return cafeFeatureIds(place, specs).map((id) => ({
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
  const [showSuggest, setShowSuggest] = useState(false);
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [sortChoice, setSortChoice] = useState<PlaceSortId | null>(null);

  const amenityFilters = useMemo(
    () =>
      filters.filter((f): f is AmenityFilterId =>
        (AMENITY_FILTER_IDS as readonly string[]).includes(f)
      ),
    [filters]
  );
  const favoritesOnly = filters.includes("favorites");

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

  // Envies and must-haves drive « Pour toi » (profile, or the guest copy).
  useEffect(() => {
    let cancelled = false;
    const load: Promise<OnboardingAnswers | null> = isAuthenticated
      ? getMyProfile().then((p) => p?.onboarding_answers ?? null)
      : Promise.resolve().then(() => readLocalOnboarding()?.answers ?? null);
    load
      .then((a) => {
        if (!cancelled) setAnswers(a);
      })
      .catch((err) => console.error("Error fetching onboarding answers:", err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const wantedForYou = useMemo(
    () =>
      answers
        ? specsForAnswers({ envies: answers.envies, needs: answers.needs })
        : [],
    [answers]
  );
  const filterSpecs = useMemo(
    () =>
      filters
        .map((f) => FILTER_SPECS[f])
        .filter((s): s is SpecId => Boolean(s)),
    [filters]
  );
  const sort: PlaceSortId =
    sortChoice ?? (wantedForYou.length > 0 ? "for_you" : "distance");
  const sortOptions = PLACE_SORTS.filter(
    (o) => o.id !== "for_you" || wantedForYou.length > 0
  );

  const allPlaceIds = useMemo(() => places.map((p) => p.id), [places]);
  const pulse = usePlacePulse(allPlaceIds);

  const ranked = useMemo(() => {
    const effectiveSavedIds = isAuthenticated ? savedIds : [];
    const rows: PlaceWithDistance[] = places
      .filter((p) => hasValidCoordinates(p))
      .filter((p) => placeMatchesFilters(p, amenityFilters, pulse))
      .filter((p) => !favoritesOnly || effectiveSavedIds.includes(p.id))
      .map((p) => ({
        ...p,
        distanceM: userCoords
          ? distanceMeters(userCoords, { lat: p.lat, lng: p.lng })
          : null,
      }));

    return sortPlaces(rows, sort, {
      specsByPlace: pulse.specs,
      wanted: sort === "for_you" ? wantedForYou : filterSpecs,
    });
    return rows;
  }, [
    places,
    amenityFilters,
    pulse,
    favoritesOnly,
    isAuthenticated,
    savedIds,
    userCoords,
    sort,
    wantedForYou,
    filterSpecs,
  ]);

  const openStatusByPlace = pulse.open ?? {};

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
          href="/top"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ds-accentsoft px-3.5 text-sm font-bold text-ds-accenttext no-underline"
        >
          <Trophy size={17} weight="bold" aria-hidden />
          Top de Nice
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

      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-2.5">
        <span className="text-sm text-ds-text2">{counterLabel}</span>
        <label className="flex items-center gap-1.5 text-sm text-ds-text2">
          <span className="sr-only sm:not-sr-only">Trier :</span>
          <select
            value={sort}
            onChange={(e) => setSortChoice(e.target.value as PlaceSortId)}
            className="h-9 rounded-full border border-ds-line bg-ds-surface px-3 text-sm font-semibold text-ds-text"
            aria-label="Trier les cafés"
          >
            {sortOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
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
                status={meta.status}
                statusDetail={meta.statusDetail}
                distance={
                  place.distanceM != null
                    ? formatDistance(place.distanceM)
                    : "—"
                }
                features={cafeFeatures(place, pulse.specs[place.id] ?? {})}
                imageSrc={place.image_url}
                href={`/place/${place.id}`}
                className={cn("max-w-none")}
              />
            );
          })
        )}

        <button
          type="button"
          onClick={() => setShowSuggest(true)}
          className="mt-2 flex w-full items-center justify-between gap-3 rounded-[20px] border-2 border-dashed border-ds-line p-4 text-left active:scale-[0.99]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Storefront size={22} weight="regular" className="flex-none text-ds-text2" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-ds-text">Un café manque ?</span>
              <span className="block text-sm text-ds-text2">Ajoute-le à la carte</span>
            </span>
          </span>
          <Plus size={20} weight="bold" className="flex-none text-ds-accent" aria-hidden />
        </button>
      </div>

      {showSuggest ? (
        <SuggestPlaceSheet
          isAuthenticated={isAuthenticated}
          onClose={() => setShowSuggest(false)}
          onSuggested={() => {
            void getPlaces({ withCoordinatesOnly: true }).then(setPlaces);
          }}
        />
      ) : null}
    </main>
  );
}
