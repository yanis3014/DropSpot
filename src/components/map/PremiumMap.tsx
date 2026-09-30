'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Map, { Marker, useMap, GeolocateControl } from 'react-map-gl';
import { Coffee, X, LockKey, MapPin, WifiHigh, Plugs, SpeakerHigh } from '@phosphor-icons/react';
import { getPlaces, Place } from '@/lib/api/places';
import { useAuth } from '@/lib/hooks/useAuth';
import FavoriteButton from '@/components/places/FavoriteButton';
import { getSavedPlaceIds, savePlace, unsavePlace } from '@/lib/api/saved';
import { getLatestVibes, CheckIn } from '@/lib/api/checkins';
import PlaceDetailModal from '@/components/spots/PlaceDetailModal';
import { openDirections } from '@/lib/utils/directions';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAP_STYLE = 'mapbox://styles/yanis3014/cmuldtuxb002h01s51acaf25v';

const filterPills = [
  { label: ' Prises', value: 'plugs' },
  { label: '☀️ Terrasse', value: 'terrace' },
  { label: '☕️ Café', value: 'coffee' },
  { label: '🎵 Ambiance', value: 'chill' },
];

function FlyToPlace({ place }: { place: Place }) {
  const { current: map } = useMap();

  if (map && place) {
    map.flyTo({
      center: [place.lng, place.lat] as [number, number],
      zoom: 15,
      duration: 1000,
      offset: [0, -150],
    });
  }

  return null;
}

export default function PremiumMap() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [vibes, setVibes] = useState<Record<string, CheckIn>>({});
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);

  useEffect(() => {
    getLatestVibes().then(setVibes);
  }, []);

  // Load Mapbox CSS dynamically
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Fetch places from Supabase
  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        setLoading(true);
        const data = await getPlaces();
        setPlaces(data);
        
        if (data.length === 0) {
          setError('No places found in database');
        }
      } catch (err) {
        console.error('Error fetching places:', err);
        setError('Failed to load places');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    getSavedPlaceIds()
      .then(setSavedIds)
      .catch((error) => console.error('Error fetching saved places:', error));
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
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setSavedIds((prev) =>
        isSaved ? [...prev, placeId] : prev.filter((id) => id !== placeId)
      );
    }
  };

  const handleMarkerClick = (e: any, place: Place) => {
    e.originalEvent.stopPropagation();
    setSelectedPlace(place);
  };

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

  if (loading) {
    return (
      <div className="w-full h-full bg-brand-oat flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-matcha mx-auto mb-4"></div>
          <p className="text-brand-mocha">Chargement des lieux...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
      {/* Map Container */}
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: 7.2620,
          latitude: 43.7102,
          zoom: 13,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
      >
        <GeolocateControl
          position="bottom-right"
          trackUserLocation={true}
          showUserHeading={true}
          showUserLocation={true}
          style={{ marginBottom: '100px' }}
        />

        {places.map((place) => {
          return (
            <Marker
              key={place.id}
              longitude={place.lng}
              latitude={place.lat}
              anchor="bottom"
              onClick={(e) => handleMarkerClick(e, place)}
            >
              <div className="bg-brand-espresso text-white rounded-full p-2 shadow-lg flex items-center justify-center border-2 border-white transform transition-transform hover:scale-110 cursor-pointer">
                <Coffee size={20} weight="fill" />
              </div>
            </Marker>
          );
        })}

        {selectedPlace && <FlyToPlace place={selectedPlace} />}
      </Map>

      {/* Floating UI Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10">
        {/* Gradient Header */}
        <div className="bg-gradient-to-b from-brand-oat/90 to-transparent p-4">
          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filterPills.map((pill) => (
              <button
                key={pill.value}
                onClick={() => setActiveFilter(activeFilter === pill.value ? null : pill.value)}
                className={`bg-white text-brand-espresso shadow-md rounded-full px-4 py-2 text-sm font-semibold border border-gray-100 whitespace-nowrap active:scale-95 transition-transform ${
                  activeFilter === pill.value ? 'ring-2 ring-brand-matcha' : ''
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Bottom Sheet */}
      <div className={`absolute bottom-20 left-4 right-4 z-40 transition-transform duration-300 ${
        selectedPlace ? 'translate-y-0' : 'translate-y-[150%]'
      }`}>
        {selectedPlace && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Close Button */}
            <button
              onClick={() => setSelectedPlace(null)}
              className="absolute top-4 right-4 z-10 bg-white/80 rounded-full p-1 hover:bg-white transition-colors"
            >
              <X size={20} weight="bold" className="text-brand-mocha" />
            </button>

            {/* Public Section */}
            <div className="relative">
              <div className="relative">
                {selectedPlace.image_url && (
                  <img
                    src={selectedPlace.image_url}
                    alt={selectedPlace.name}
                    className="w-full h-32 object-cover"
                  />
                )}
                <FavoriteButton
                  placeId={selectedPlace.id}
                  isSaved={savedIds.includes(selectedPlace.id)}
                  onToggle={handleToggleSave}
                  size={16}
                  className="absolute top-2.5 right-2.5 w-8 h-8"
                />
              </div>
              <div className="p-4">
                <h3 className="text-xl font-bold text-brand-espresso mb-2">{selectedPlace.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openDirections(selectedPlace)}
                    className="flex-1 flex items-center justify-center gap-2 bg-brand-espresso text-white rounded-xl py-3 font-semibold shadow-sm hover:bg-brand-espresso/90 active:scale-95 transition-all"
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

            {/* Soft-Gate Section */}
            <div className="p-4 border-t border-brand-mocha/10 relative overflow-hidden">
              <h4 className="text-sm font-semibold text-brand-mocha mb-3">Infos pratiques</h4>
              
              {/* Premium Metrics (blurred until the user is logged in) */}
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
                      <p className="text-sm font-semibold text-brand-espresso">{selectedPlace.wifi_speed}</p>
                    </div>
                  </div>
                )}
                {selectedPlace.has_plugs !== undefined && (
                  <div className="flex items-center gap-3 p-2 bg-brand-oat rounded-lg">
                    <Plugs size={20} weight="duotone" className="text-brand-mocha" />
                    <div>
                      <p className="text-xs text-brand-mocha">Prises</p>
                      <p className="text-sm font-semibold text-brand-espresso">{selectedPlace.has_plugs ? 'Disponibles' : 'Limitées'}</p>
                    </div>
                  </div>
                )}
                {selectedPlace.noise_level && (
                  <div className="flex items-center gap-3 p-2 bg-brand-oat rounded-lg">
                    <SpeakerHigh size={20} weight="duotone" className="text-brand-mocha" />
                    <div>
                      <p className="text-xs text-brand-mocha">Ambiance</p>
                      <p className="text-sm font-semibold text-brand-espresso">{selectedPlace.noise_level}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Soft-Gate Overlay (only for guests) */}
              {!isAuthenticated && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-brand-oat/60 backdrop-blur-[2px]">
                  <LockKey weight="duotone" size={28} className="text-brand-terracotta mb-2" />
                  <p className="text-xs text-center font-medium text-brand-espresso mb-3">
                    Connecte-toi pour voir les specs
                  </p>
                  <button
                    onClick={() => router.push('/login')}
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
    </div>
  );
}
