'use client';

import { useState, useEffect, useMemo } from 'react';
import Map, { Marker, useMap, GeolocateControl, type ErrorEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Coffee, X, LockKey, MapPin, WifiHigh, Plugs, SpeakerHigh } from '@phosphor-icons/react';
import { getMapPlaces, getPlaceById, Place, hasValidCoordinates } from '@/lib/api/places';
import { peekCache } from '@/lib/cache/clientCache';
import { useAuth } from '@/lib/hooks/useAuth';
import FavoriteButton from '@/components/places/FavoriteButton';
import { getSavedPlaceIds, savePlace, unsavePlace } from '@/lib/api/saved';
import { getLatestVibes, CheckIn } from '@/lib/api/checkins';
import PlaceDetailModal from '@/components/spots/PlaceDetailModal';
import LoginModal from '@/components/auth/LoginModal';
import { openDirections } from '@/lib/utils/directions';
import { placeMatchesFilter } from '@/lib/filters';
import MapSkeleton from '@/components/map/MapSkeleton';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAP_STYLE = 'mapbox://styles/yanis3014/cmuldtuxb002h01s51acaf25v';

const filterPills = [
  { label: '🔌 Prises', value: 'plugs' },
  { label: '☀️ Terrasse', value: 'terrace' },
  { label: '☕️ Café', value: 'coffee' },
  { label: '🎵 Ambiance', value: 'chill' },
];

function FlyToPlace({ place }: { place: Place }) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map || !hasValidCoordinates(place)) return;
    map.flyTo({
      center: [place.lng, place.lat] as [number, number],
      zoom: 15,
      duration: 1000,
      offset: [0, -150],
    });
  }, [map, place]);

  return null;
}

// react-map-gl already calls map.remove() on unmount; in-flight tile requests then
// reject with AbortError ("Actor removed"), which is expected teardown noise.
function handleMapError(event: ErrorEvent) {
  const err = event.error as { name?: string; message?: string } | undefined;
  if (err?.name === 'AbortError' || err?.message?.includes('Actor removed')) return;
  console.error('Mapbox error:', event.error);
}

export default function PremiumMap() {
  const { isAuthenticated } = useAuth();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>(
    () => peekCache<Place[]>('places:map') ?? []
  );
  const [loading, setLoading] = useState(() => !peekCache('places:map'));
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [vibes, setVibes] = useState<Record<string, CheckIn>>({});
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    getLatestVibes().then(setVibes);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchPlaces = async () => {
      try {
        if (!peekCache('places:map')) setLoading(true);
        const data = await getMapPlaces();
        if (cancelled) return;
        setPlaces(data);
        if (data.length === 0) setError('No places found in database');
        else setError(null);
      } catch (err) {
        console.error('Error fetching places:', err);
        if (!cancelled) setError('Failed to load places');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPlaces();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    getSavedPlaceIds()
      .then(setSavedIds)
      .catch((err) => console.error('Error fetching saved places:', err));
  }, [isAuthenticated]);

  const handleToggleSave = async (placeId: string) => {
    const isSaved = savedIds.includes(placeId);
    setSavedIds((prev) =>
      isSaved ? prev.filter((id) => id !== placeId) : [...prev, placeId]
    );
    try {
      if (isSaved) {
        await unsavePlace(placeId);
      } else {
        await savePlace(placeId);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setSavedIds((prev) =>
        isSaved ? [...prev, placeId] : prev.filter((id) => id !== placeId)
      );
    }
  };

  const handleMarkerClick = async (
    e: { originalEvent: { stopPropagation: () => void } },
    place: Place
  ) => {
    e.originalEvent.stopPropagation();
    setSelectedPlace(place);
    // Hydrate image + rich fields on demand (map query is marker-light).
    try {
      const full = await getPlaceById(place.id);
      if (full) setSelectedPlace(full);
    } catch (err) {
      console.error('Error hydrating place:', err);
    }
  };

  // Cached state can predate coordinate filtering, so re-check before rendering markers.
  const visiblePlaces = useMemo(
    () =>
      places.filter(
        (p) => hasValidCoordinates(p) && placeMatchesFilter(p, activeFilter)
      ),
    [places, activeFilter]
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full bg-brand-oat flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <MapPin size={48} className="text-brand-terracotta mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-brand-espresso mb-4">Mapbox non configuré</h2>
          <p className="text-brand-mocha mb-4">
            Configurez NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN dans .env.local
          </p>
          <p className="text-sm text-brand-mocha/60">
            Obtenez un token gratuit sur{' '}
            <a
              href="https://account.mapbox.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-matcha underline"
            >
              Mapbox
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (loading && places.length === 0) {
    return <MapSkeleton />;
  }

  if (error && places.length === 0) {
    return (
      <div className="w-full h-full bg-brand-oat flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <MapPin size={48} className="text-brand-terracotta mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-brand-espresso mb-4">Erreur de chargement</h2>
          <p className="text-brand-mocha mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] absolute inset-0">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: 7.262,
          latitude: 43.7102,
          zoom: 13,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        onError={handleMapError}
      >
        <GeolocateControl
          position="bottom-right"
          trackUserLocation={true}
          showUserHeading={true}
          showUserLocation={true}
          style={{ marginBottom: '100px' }}
        />

        {visiblePlaces.map((place) => (
          <Marker
            key={place.id}
            longitude={place.lng}
            latitude={place.lat}
            anchor="bottom"
            onClick={(e) => handleMarkerClick(e, place)}
          >
            <div className="bg-brand-ink text-white rounded-full p-2 shadow-lg flex items-center justify-center border-2 border-brand-surface transform transition-transform hover:scale-110 cursor-pointer">
              <Coffee size={20} weight="fill" />
            </div>
          </Marker>
        ))}

        {selectedPlace && hasValidCoordinates(selectedPlace) && (
          <FlyToPlace place={selectedPlace} />
        )}
      </Map>

      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="bg-gradient-to-b from-brand-oat/90 to-transparent p-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filterPills.map((pill) => (
              <button
                key={pill.value}
                onClick={() =>
                  setActiveFilter(activeFilter === pill.value ? null : pill.value)
                }
                className={`bg-brand-surface text-brand-espresso shadow-md rounded-full px-4 py-2 text-sm font-semibold border border-brand-mocha/10 whitespace-nowrap active:scale-95 transition-transform ${
                  activeFilter === pill.value ? 'ring-2 ring-brand-matcha' : ''
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`absolute bottom-20 left-4 right-4 z-40 transition-transform duration-300 ${
          selectedPlace ? 'translate-y-0' : 'translate-y-[150%]'
        }`}
      >
        {selectedPlace && (
          <div className="bg-brand-surface rounded-2xl shadow-xl overflow-hidden relative">
            <div className="relative">
              <div className="relative">
                {selectedPlace.image_url ? (
                  <img
                    src={selectedPlace.image_url}
                    alt={selectedPlace.name}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-brand-muted to-brand-mocha/20 animate-pulse" />
                )}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <FavoriteButton
                    placeId={selectedPlace.id}
                    isSaved={savedIds.includes(selectedPlace.id)}
                    onToggle={handleToggleSave}
                    size={16}
                    className="w-9 h-9 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedPlace(null)}
                    aria-label="Fermer"
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-brand-surface/90 backdrop-blur-sm shadow-md hover:bg-brand-surface active:scale-95 transition-all"
                  >
                    <X size={18} weight="bold" className="text-brand-espresso" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-xl font-bold text-brand-espresso mb-2">
                  {selectedPlace.name}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openDirections(selectedPlace)}
                    className="flex-1 flex items-center justify-center gap-2 bg-brand-ink text-white rounded-xl py-3 font-semibold shadow-sm hover:bg-brand-ink/90 active:scale-95 transition-all"
                  >
                    <MapPin size={20} weight="fill" />
                    <span>S&apos;y rendre</span>
                  </button>
                  <button
                    onClick={() => setDetailPlace(selectedPlace)}
                    className="flex-1 flex items-center justify-center bg-brand-oat text-brand-espresso rounded-xl py-3 font-semibold shadow-sm hover:bg-brand-oat/80 active:scale-95 transition-all"
                  >
                    Voir la fiche
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-brand-mocha/10 relative overflow-hidden">
              <h4 className="text-sm font-semibold text-brand-mocha mb-3">Infos pratiques</h4>

              <div
                className={`space-y-2 transition-all duration-300 ${
                  isAuthenticated ? '' : 'blur-sm opacity-40 select-none pointer-events-none'
                }`}
              >
                {selectedPlace.wifi_speed && (
                  <div className="flex items-center gap-3 p-2 bg-brand-oat rounded-lg">
                    <WifiHigh size={20} weight="duotone" className="text-brand-mocha" />
                    <div>
                      <p className="text-xs text-brand-mocha">Wi-Fi</p>
                      <p className="text-sm font-semibold text-brand-espresso">
                        {selectedPlace.wifi_speed}
                      </p>
                    </div>
                  </div>
                )}
                {selectedPlace.has_plugs !== undefined && (
                  <div className="flex items-center gap-3 p-2 bg-brand-oat rounded-lg">
                    <Plugs size={20} weight="duotone" className="text-brand-mocha" />
                    <div>
                      <p className="text-xs text-brand-mocha">Prises</p>
                      <p className="text-sm font-semibold text-brand-espresso">
                        {selectedPlace.has_plugs ? 'Disponibles' : 'Limitées'}
                      </p>
                    </div>
                  </div>
                )}
                {selectedPlace.noise_level && (
                  <div className="flex items-center gap-3 p-2 bg-brand-oat rounded-lg">
                    <SpeakerHigh size={20} weight="duotone" className="text-brand-mocha" />
                    <div>
                      <p className="text-xs text-brand-mocha">Ambiance</p>
                      <p className="text-sm font-semibold text-brand-espresso">
                        {selectedPlace.noise_level}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {!isAuthenticated && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-brand-oat/60 backdrop-blur-[2px]">
                  <LockKey weight="duotone" size={28} className="text-brand-terracotta mb-2" />
                  <p className="text-xs text-center font-medium text-brand-espresso mb-3">
                    Connecte-toi pour voir les specs
                  </p>
                  <button
                    onClick={() => setShowLogin(true)}
                    className="bg-brand-matcha text-white text-xs px-4 py-2 rounded-lg font-semibold shadow-sm active:scale-95 transition-all"
                  >
                    Connexion
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {detailPlace && (
        <PlaceDetailModal
          place={detailPlace}
          vibe={vibes[detailPlace.id]}
          isAuthenticated={isAuthenticated}
          isSaved={savedIds.includes(detailPlace.id)}
          onToggleSave={handleToggleSave}
          onCheckedIn={() => getLatestVibes().then(setVibes)}
          onClose={() => setDetailPlace(null)}
        />
      )}

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
