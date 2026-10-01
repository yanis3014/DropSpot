'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Coffee,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  Crosshair,
  X,
  Lightning,
} from '@phosphor-icons/react';
import Link from 'next/link';
import CheckInModal from '@/components/spots/CheckInModal';
import { useAuth } from '@/lib/hooks/useAuth';
import { getPlaces, Place } from '@/lib/api/places';
import { hasValidCoordinates } from '@/lib/filters';
import {
  distanceMeters,
  formatDistance,
  getCurrentPosition,
  type LatLng,
} from '@/lib/geo';
import { getGrainsBalance } from '@/lib/grains';

const NEARBY_RADIUS_M = 100;

type LocatePhase = 'loading' | 'ready' | 'denied' | 'error';

type PlaceWithDistance = Place & { distanceM: number };

export default function CheckInPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [phase, setPhase] = useState<LocatePhase>('loading');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [grains, setGrains] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [forceSearch, setForceSearch] = useState(false);

  useEffect(() => {
    setGrains(getGrainsBalance());
  }, []);

  const locate = useCallback(async () => {
    setPhase('loading');
    setForceSearch(false);

    const [placesResult, geo] = await Promise.all([
      getPlaces().catch((err) => {
        console.error('Error loading places:', err);
        return [] as Place[];
      }),
      getCurrentPosition(),
    ]);

    setPlaces(placesResult);

    if (!geo.ok) {
      setUserCoords(null);
      setPhase(geo.reason === 'denied' ? 'denied' : 'error');
      return;
    }

    setUserCoords(geo.coords);
    setPhase('ready');
  }, []);

  useEffect(() => {
    if (!authLoading) void locate();
  }, [authLoading, locate]);

  const rankedPlaces = useMemo((): PlaceWithDistance[] => {
    if (!userCoords) return [];
    return places
      .filter(hasValidCoordinates)
      .map((p) => ({
        ...p,
        distanceM: distanceMeters(userCoords, { lat: p.lat, lng: p.lng }),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
  }, [places, userCoords]);

  const nearbyPlace = useMemo(() => {
    const hit = rankedPlaces.find((p) => p.distanceM <= NEARBY_RADIUS_M);
    return hit ?? null;
  }, [rankedPlaces]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = userCoords ? rankedPlaces : places.filter(hasValidCoordinates);
    if (!q) return base.slice(0, 12);
    return base
      .filter((p) =>
        [p.name, p.address, p.city, p.category]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [places, rankedPlaces, searchQuery, userCoords]);

  const showSearch =
    forceSearch ||
    phase === 'denied' ||
    phase === 'error' ||
    (phase === 'ready' && !nearbyPlace);

  const handleSubmitted = (earned: number) => {
    setGrains(getGrainsBalance());
    setToast(`Check-in validé ! +${earned} Grains 🌾`);
    window.setTimeout(() => setToast(null), 3200);
  };

  if (authLoading || phase === 'loading') {
    return (
      <div className="flex-1 pb-24 flex flex-col">
        <Header grains={grains} />
        <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-8">
          <div className="relative w-36 h-36 mb-8">
            <span className="absolute inset-0 rounded-full border-2 border-brand-matcha/30 animate-ping" />
            <span className="absolute inset-3 rounded-full border-2 border-brand-matcha/40 animate-pulse" />
            <span className="absolute inset-8 rounded-full bg-brand-matcha/15 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Crosshair size={36} weight="duotone" className="text-brand-matcha" />
            </div>
          </div>
          <p className="text-lg font-extrabold text-brand-espresso text-center">
            Scan des environs…
          </p>
          <p className="mt-1.5 text-sm text-brand-mocha text-center max-w-[240px]">
            On cherche le café le plus proche de toi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-24">
      <Header grains={grains} />

      {nearbyPlace && !showSearch ? (
        <div className="px-5 mt-2">
          <div className="relative overflow-hidden rounded-[28px] bg-brand-surface border border-brand-mocha/10 shadow-lg">
            <div className="relative h-44 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
              {nearbyPlace.image_url ? (
                <img
                  src={nearbyPlace.image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Coffee size={48} weight="duotone" className="text-white/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-espresso/85 via-brand-espresso/25 to-transparent" />
              <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-brand-matcha text-white text-[11px] font-bold px-2.5 py-1 shadow-md">
                <NavigationArrow size={12} weight="fill" />
                {formatDistance(nearbyPlace.distanceM)}
              </span>
            </div>

            <div className="p-5 text-center">
              <p className="text-2xl font-extrabold text-brand-espresso tracking-tight leading-snug">
                📍 Es-tu à {nearbyPlace.name} ?
              </p>
              {nearbyPlace.address && (
                <p className="mt-2 text-sm text-brand-mocha flex items-center justify-center gap-1">
                  <MapPin size={14} weight="fill" className="text-brand-terracotta flex-shrink-0" />
                  <span className="truncate">{nearbyPlace.address}</span>
                </p>
              )}

              <button
                type="button"
                onClick={() => setSelectedPlace(nearbyPlace)}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-brand-matcha text-white font-extrabold text-base py-4 rounded-2xl shadow-lg shadow-brand-matcha/30 hover:bg-brand-matcha/90 active:scale-[0.98] transition-all"
              >
                <Lightning size={20} weight="fill" />
                Faire mon Check-in
              </button>

              <button
                type="button"
                onClick={() => setForceSearch(true)}
                className="mt-3 text-sm font-semibold text-brand-mocha hover:text-brand-espresso transition-colors"
              >
                Ce n&apos;est pas le bon spot
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void locate()}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-semibold text-brand-matcha py-2.5"
          >
            <Crosshair size={16} weight="bold" />
            Relancer le GPS
          </button>
        </div>
      ) : (
        <div className="px-5 mt-1">
          {(phase === 'denied' || phase === 'error') && (
            <div className="mb-4 rounded-2xl bg-brand-terracotta/10 border border-brand-terracotta/20 p-4">
              <p className="text-sm font-bold text-brand-espresso">
                {phase === 'denied'
                  ? 'Localisation refusée'
                  : 'Localisation indisponible'}
              </p>
              <p className="text-xs text-brand-mocha mt-1">
                Cherche ton café manuellement, ou autorise le GPS pour un check-in
                ultra-rapide.
              </p>
              <button
                type="button"
                onClick={() => void locate()}
                className="mt-3 text-xs font-bold text-brand-matcha"
              >
                Réessayer le GPS
              </button>
            </div>
          )}

          {phase === 'ready' && !nearbyPlace && (
            <div className="mb-4 text-center">
              <p className="text-base font-bold text-brand-espresso">
                Aucun café à proximité
              </p>
              <p className="text-sm text-brand-mocha mt-1">
                Cherche ton spot pour faire un check-in.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 bg-brand-surface rounded-2xl px-4 py-3 shadow-sm border border-brand-mocha/10 focus-within:border-brand-matcha/40 transition-all">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="text-brand-mocha flex-shrink-0"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Chercher un café…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-brand-espresso placeholder:text-brand-mocha/50"
              autoFocus={forceSearch}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer"
                className="text-brand-mocha/60 hover:text-brand-espresso"
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>

          {nearbyPlace && forceSearch && (
            <button
              type="button"
              onClick={() => setForceSearch(false)}
              className="mt-3 text-sm font-semibold text-brand-matcha"
            >
              ← Retour au spot détecté ({nearbyPlace.name})
            </button>
          )}

          <div className="mt-4 space-y-2.5">
            {searchResults.length === 0 ? (
              <div className="text-center py-10">
                <Coffee size={32} weight="duotone" className="text-brand-mocha/40 mx-auto mb-3" />
                <p className="font-semibold text-brand-espresso">Aucun résultat</p>
                <p className="text-sm text-brand-mocha mt-1">Essaie un autre nom.</p>
              </div>
            ) : (
              searchResults.map((place) => {
                const distanceM =
                  'distanceM' in place && typeof place.distanceM === 'number'
                    ? place.distanceM
                    : null;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => setSelectedPlace(place)}
                    className="w-full text-left bg-brand-surface rounded-2xl border border-brand-mocha/8 p-3 flex items-center gap-3 shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-brand-oat">
                      {place.image_url ? (
                        <img
                          src={place.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Coffee
                            size={22}
                            weight="duotone"
                            className="text-brand-mocha/40"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-brand-espresso text-sm truncate">
                        {place.name}
                      </p>
                      <p className="text-[11px] text-brand-mocha truncate mt-0.5">
                        {distanceM != null
                          ? formatDistance(distanceM)
                          : place.address || place.city || 'Café'}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs font-bold text-brand-matcha bg-brand-matcha/10 px-3 py-2 rounded-full">
                      Check-in
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 w-[min(92vw,22rem)] rounded-2xl bg-brand-ink text-white px-4 py-3 shadow-xl text-center text-sm font-bold animate-[fadeIn_0.25s_ease-out]">
          {toast}
        </div>
      )}

      {selectedPlace && (
        <CheckInModal
          place={selectedPlace}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedPlace(null)}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}

function Header({ grains }: { grains: number }) {
  return (
    <div className="px-5 pt-6 pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
          Check-in
        </h1>
        <p className="text-sm text-brand-mocha mt-1">
          Confirme ta présence et gagne des Grains.
        </p>
      </div>
      <Link
        href="/gamification"
        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-surface border border-brand-mocha/10 px-3 py-1.5 shadow-sm hover:border-brand-matcha/30 hover:shadow-md active:scale-95 transition-all"
      >
        <span className="text-sm" aria-hidden>
          🌾
        </span>
        <span className="text-sm font-extrabold text-brand-espresso tabular-nums">
          {grains}
        </span>
      </Link>
    </div>
  );
}
