"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Map, {
  Marker,
  useMap,
  GeolocateControl,
  type ErrorEvent,
  type MapRef,
} from "react-map-gl";
import type { GeolocateControl as MapboxGeolocateControl } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  CalendarBlank,
  CircleNotch,
  Clock,
  Coffee,
  Crosshair,
  Leaf,
  GpsSlash,
  Moon,
  WifiHigh,
} from "@phosphor-icons/react";
import { getPlaces, getPlaceById, type Place } from "@/lib/api/places";
import { peekCache } from "@/lib/cache/clientCache";
import { hasValidCoordinates, placeMatchesFilters } from "@/lib/filters";
import {
  cafeFeatureIds,
  cafeOpenStatus,
  pinKindFor,
  type CafeFeatureId,
} from "@/lib/cafePresentation";
import { AMENITY_FILTER_IDS, type AmenityFilterId } from "@/lib/mapFilters";
import { usePlaceFilters } from "@/lib/hooks/usePlaceFilters";
import {
  distanceMeters,
  formatDistance,
  getCurrentPosition,
  type LatLng,
} from "@/lib/geo";
import { useTheme } from "@/lib/theme";
import MapPin from "@/components/ui/MapPin";
import CafeRow, { type CafeRowFeature } from "@/components/ui/CafeRow";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAP_STYLE_LIGHT = "mapbox://styles/yanis3014/cmuldtuxb002h01s51acaf25v";
const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11";

/**
 * Distance (m) between the map center and the user's position beyond which
 * the "Près de moi" button comes back, like Google Maps' recenter button.
 */
const RECENTER_BUTTON_DISTANCE_M = 300;
/** Max wait for a position after a tap on "Près de moi" before giving up. */
const GEOLOCATE_TIMEOUT_MS = 10_000;
/** How long the "position not found" hint stays on screen. */
const GEOLOCATE_ERROR_HINT_MS = 4_000;
/** GeolocationPositionError.PERMISSION_DENIED */
const GEO_ERROR_PERMISSION_DENIED = 1;

const FILTER_CHIPS: {
  id: AmenityFilterId;
  label: string;
  Icon: typeof WifiHigh;
}[] = [
  { id: "wifi", label: "Wi-Fi", Icon: WifiHigh },
  { id: "matcha", label: "Matcha", Icon: Leaf },
  { id: "calme", label: "Calme", Icon: Moon },
  { id: "open_now", label: "Ouvert maintenant", Icon: Clock },
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

function pinIconFor(place: Place): ReactNode {
  switch (pinKindFor(place)) {
    case "wifi":
      return <WifiHigh size={20} weight="regular" />;
    case "matcha":
      return <Leaf size={20} weight="regular" />;
    case "calme":
      return <Moon size={20} weight="regular" />;
    case "activites":
      return <CalendarBlank size={20} weight="regular" />;
    default:
      return <Coffee size={20} weight="regular" />;
  }
}

function FlyToPlace({ place }: { place: Place }) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map || !hasValidCoordinates(place)) return;
    map.flyTo({
      center: [place.lng, place.lat] as [number, number],
      zoom: 15,
      duration: 1000,
      offset: [0, -120],
    });
  }, [map, place]);

  return null;
}

function handleMapError(event: ErrorEvent) {
  const err = event.error as { name?: string; message?: string } | undefined;
  if (err?.name === "AbortError" || err?.message?.includes("Actor removed"))
    return;
  console.error("Mapbox error:", event.error);
}

async function triggerGeolocateIfGranted(
  control: MapboxGeolocateControl | null
) {
  if (!control) return;
  try {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state === "granted") {
      control.trigger();
    }
  } catch (err) {
    console.warn("Error checking geolocation permission:", err);
  }
}

export default function PremiumMap() {
  const router = useRouter();
  const { resolved: theme } = useTheme();
  const { filters, toggleFilter } = usePlaceFilters();

  const amenityFilters = useMemo(
    () => filters.filter((f): f is AmenityFilterId =>
      (AMENITY_FILTER_IDS as readonly string[]).includes(f)
    ),
    [filters]
  );

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [places, setPlaces] = useState<Place[]>(
    () => peekCache<Place[]>("places:full") ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [locBannerDismissed, setLocBannerDismissed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [farFromUser, setFarFromUser] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);

  const mapRef = useRef<MapRef>(null);
  const geolocateControlRef = useRef<MapboxGeolocateControl | null>(null);
  const didAutoGeolocate = useRef(false);
  // The Mapbox control's trigger() toggles: from an error state it turns
  // tracking off, so a retry then needs a second trigger().
  const geolocateErroredRef = useRef(false);
  const locateTimeoutRef = useRef<number | null>(null);
  const showLocDenied = geoDenied && !locBannerDismissed && !userCoords;
  const showNearMe =
    locating || !userCoords || (!isTracking && farFromUser);

  const mapStyle = theme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  // The map starts right away; markers appear once places arrive, so Mapbox
  // and the Supabase query load in parallel instead of one after the other.
  useEffect(() => {
    let cancelled = false;

    const fetchPlaces = async () => {
      try {
        const data = await getPlaces({ withCoordinatesOnly: true });
        if (cancelled) return;
        setPlaces(data);
        if (data.length === 0) setError("Aucun café trouvé");
        else setError(null);
      } catch (err) {
        console.error("Error fetching places:", err);
        if (!cancelled) setError("Impossible de charger les cafés");
      }
    };

    void fetchPlaces();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncPermission = async () => {
      if (typeof navigator === "undefined" || !navigator.permissions?.query) {
        return;
      }
      try {
        const status = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        if (cancelled) return;
        if (status.state === "denied") setGeoDenied(true);
        status.onchange = () => {
          if (status.state === "denied") setGeoDenied(true);
          else if (status.state === "granted") {
            setGeoDenied(false);
            setLocBannerDismissed(false);
          }
        };
      } catch {
        // Permissions API may reject geolocation on some browsers
      }
    };
    void syncPermission();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMapLoad = useCallback(() => {
    if (didAutoGeolocate.current) return;
    didAutoGeolocate.current = true;
    requestAnimationFrame(() => {
      void triggerGeolocateIfGranted(geolocateControlRef.current);
    });
  }, []);

  const stopLocating = useCallback(() => {
    setLocating(false);
    if (locateTimeoutRef.current !== null) {
      window.clearTimeout(locateTimeoutRef.current);
      locateTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => stopLocating, [stopLocating]);

  useEffect(() => {
    if (!locateFailed) return;
    const id = window.setTimeout(
      () => setLocateFailed(false),
      GEOLOCATE_ERROR_HINT_MS
    );
    return () => window.clearTimeout(id);
  }, [locateFailed]);

  const updateFarFromUser = useCallback((coords: LatLng | null) => {
    const center = mapRef.current?.getCenter();
    if (!coords || !center) return;
    setFarFromUser(
      distanceMeters(coords, { lat: center.lat, lng: center.lng }) >
        RECENTER_BUTTON_DISTANCE_M
    );
  }, []);

  // The user may also walk away from where the map was left.
  useEffect(() => {
    updateFarFromUser(userCoords);
  }, [userCoords, updateFarFromUser]);

  const handleNearMe = () => {
    const control = geolocateControlRef.current;
    if (!control || locating) return;
    setLocateFailed(false);
    if (userCoords && !geolocateErroredRef.current) {
      // Position already known: the control just recenters on it.
      control.trigger();
      return;
    }
    setLocating(true);
    locateTimeoutRef.current = window.setTimeout(() => {
      locateTimeoutRef.current = null;
      setLocating(false);
      setLocateFailed(true);
    }, GEOLOCATE_TIMEOUT_MS);
    if (geolocateErroredRef.current) {
      geolocateErroredRef.current = false;
      control.trigger();
    }
    if (!control.trigger()) stopLocating();
  };

  const handleEnableLocation = useCallback(async () => {
    setLocBannerDismissed(false);
    const result = await getCurrentPosition();
    if (result.ok) {
      setGeoDenied(false);
      setUserCoords(result.coords);
      geolocateControlRef.current?.trigger();
      mapRef.current?.flyTo({
        center: [result.coords.lng, result.coords.lat],
        zoom: 14,
        duration: 1000,
      });
      return;
    }
    if (result.reason === "denied") {
      setGeoDenied(true);
    }
  }, []);

  const handleMarkerClick = async (
    e: { originalEvent: { stopPropagation: () => void } },
    place: Place
  ) => {
    e.originalEvent.stopPropagation();
    setSelectedPlace(place);
    try {
      const full = await getPlaceById(place.id);
      if (full) setSelectedPlace(full);
    } catch (err) {
      console.error("Error hydrating place:", err);
    }
  };

  const visiblePlaces = useMemo(
    () =>
      places.filter(
        (p) =>
          hasValidCoordinates(p) && placeMatchesFilters(p, amenityFilters)
      ),
    [places, amenityFilters]
  );

  const selectedMeta = selectedPlace ? cafeOpenStatus(selectedPlace) : null;

  const selectedDistance =
    selectedPlace && userCoords && hasValidCoordinates(selectedPlace)
      ? formatDistance(
          distanceMeters(userCoords, {
            lat: selectedPlace.lat,
            lng: selectedPlace.lng,
          })
        )
      : "—";

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-ds-bg p-6">
        <div className="text-center">
          <h2 className="mb-4 font-display text-2xl font-bold text-ds-text">
            Mapbox non configuré
          </h2>
          <p className="mb-4 text-ds-text2">
            Configure NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN dans .env.local
          </p>
        </div>
      </div>
    );
  }

  if (error && places.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-ds-bg p-6">
        <div className="text-center">
          <h2 className="mb-4 font-display text-2xl font-bold text-ds-text">
            Erreur de chargement
          </h2>
          <p className="text-ds-text2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 h-[100dvh] w-full">
      <Map
        key={mapStyle}
        ref={mapRef}
        // Keep the Mapbox instance (WebGL context, style, tiles) when leaving
        // the Carte tab, so coming back does not rebuild the map from scratch.
        reuseMaps
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: 7.262,
          latitude: 43.7102,
          zoom: 13,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        attributionControl={false}
        onError={handleMapError}
        onLoad={handleMapLoad}
        onMove={() => updateFarFromUser(userCoords)}
        onClick={() => setSelectedPlace(null)}
      >
        <GeolocateControl
          ref={geolocateControlRef}
          position="top-right"
          trackUserLocation
          showUserLocation
          showUserHeading
          positionOptions={{
            enableHighAccuracy: true,
            timeout: GEOLOCATE_TIMEOUT_MS,
          }}
          style={{ display: "none" }}
          onGeolocate={(e) => {
            geolocateErroredRef.current = false;
            stopLocating();
            setLocateFailed(false);
            setGeoDenied(false);
            setUserCoords({
              lat: e.coords.latitude,
              lng: e.coords.longitude,
            });
          }}
          onTrackUserLocationStart={() => setIsTracking(true)}
          onTrackUserLocationEnd={() => setIsTracking(false)}
          onError={(e) => {
            if (e.code === GEO_ERROR_PERMISSION_DENIED) {
              // The control is already off in this case.
              setGeoDenied(true);
              setLocBannerDismissed(false);
            } else {
              geolocateErroredRef.current = true;
              if (locating) setLocateFailed(true);
            }
            stopLocating();
          }}
        />

        {visiblePlaces.map((place) => {
          const selected = selectedPlace?.id === place.id;
          return (
            <Marker
              key={place.id}
              longitude={place.lng}
              latitude={place.lat}
              anchor="center"
              onClick={(e) => handleMarkerClick(e, place)}
            >
              <MapPin
                icon={pinIconFor(place)}
                selected={selected}
                label={selected ? place.name : undefined}
                aria-label={place.name}
                className={cn("shadow-ds", selected && "max-w-[220px]")}
                onClick={(ev) => {
                  ev.stopPropagation();
                  void handleMarkerClick(
                    { originalEvent: { stopPropagation: () => undefined } },
                    place
                  );
                }}
              />
            </Marker>
          );
        })}

        {selectedPlace && hasValidCoordinates(selectedPlace) && (
          <FlyToPlace place={selectedPlace} />
        )}
      </Map>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 safe-pt">
        <div className="pointer-events-auto flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-2">
          {FILTER_CHIPS.map(({ id, label, Icon }) => {
            const active = filters.includes(id);
            return (
              <Chip
                key={id}
                active={active}
                icon={<Icon size={16} weight="regular" aria-hidden />}
                onClick={() => toggleFilter(id)}
                className="shadow-ds"
              >
                {label}
              </Chip>
            );
          })}
          <div className="w-2 shrink-0" aria-hidden />
        </div>
      </div>

      {!showLocDenied ? (
        <button
          type="button"
          onClick={handleNearMe}
          disabled={locating}
          aria-busy={locating}
          aria-hidden={!showNearMe}
          tabIndex={showNearMe ? 0 : -1}
          className={cn(
            "absolute left-1/2 z-20 flex h-[52px] -translate-x-1/2 items-center justify-center gap-2 rounded-[26px] bg-ds-accent px-5 text-base font-bold text-ds-onaccent shadow-ds transition-[opacity,transform,bottom] duration-300",
            selectedPlace ? "bottom-[13.5rem]" : "bottom-28",
            showNearMe
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-3 scale-90 opacity-0"
          )}
        >
          {locating ? (
            <>
              <CircleNotch
                size={22}
                weight="bold"
                className="animate-spin"
                aria-hidden
              />
              Recherche…
            </>
          ) : (
            <>
              <Crosshair size={22} weight="regular" aria-hidden />
              Près de moi
            </>
          )}
        </button>
      ) : null}

      {locateFailed && !showLocDenied ? (
        <p
          role="status"
          className={cn(
            "absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-ds-surface px-4 py-2 text-sm font-medium text-ds-text shadow-ds",
            selectedPlace ? "bottom-[17.5rem]" : "bottom-[11rem]"
          )}
        >
          Position introuvable, réessaie dans un instant.
        </p>
      ) : null}

      {showLocDenied ? (
        <div className="absolute inset-x-4 bottom-28 z-30 rounded-3xl bg-ds-surface px-5 pb-3.5 pt-6 shadow-ds">
          <EmptyState
            icon={<GpsSlash weight="regular" />}
            title="Localisation désactivée"
            description="Active-la pour voir les cafés autour de toi."
            actionLabel="Activer la localisation"
            onAction={() => void handleEnableLocation()}
            secondaryLabel="Chercher une adresse"
            onSecondary={() => router.push("/list")}
            className="px-1"
          />
        </div>
      ) : null}

      <div
        className={cn(
          "absolute inset-x-4 z-30 transition-transform duration-300",
          selectedPlace && !showLocDenied
            ? "bottom-24 translate-y-0"
            : "bottom-24 translate-y-[140%]"
        )}
      >
        {selectedPlace && selectedMeta ? (
          <CafeRow
            name={selectedPlace.name}
            rating="—"
            status={selectedMeta.status}
            statusDetail={selectedMeta.statusDetail}
            distance={selectedDistance}
            features={cafeFeatures(selectedPlace)}
            imageSrc={selectedPlace.image_url}
            className="max-w-none rounded-[22px] border-0 shadow-ds"
            onClick={() => router.push(`/place/${selectedPlace.id}`)}
          />
        ) : null}
      </div>
    </div>
  );
}
