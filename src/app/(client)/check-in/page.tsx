'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Coffee,
  MagnifyingGlass,
  Crosshair,
  Plus,
  Storefront,
  X,
} from '@phosphor-icons/react';
import Link from 'next/link';
import CheckInModal from '@/components/spots/CheckInModal';
import TrophyModal from '@/components/places/TrophyModal';
import { useAuth } from '@/lib/hooks/useAuth';
import { getPlaces, Place } from '@/lib/api/places';
import { hasValidCoordinates } from '@/lib/filters';
import {
  distanceMeters,
  formatDistance,
  getCurrentPosition,
  type LatLng,
} from '@/lib/geo';
import { getGrainsBalance, GRAINS_PROXIMITY_M } from '@/lib/grains';
import {
  getAggregatedVibes,
  formatVibeSummary,
  type AggregatedVibe,
} from '@/lib/api/checkins';
import {
  clearCheckInSession,
  formatSessionRemaining,
  getActiveSession,
  sessionRemainingMs,
  type CheckInSession,
} from '@/lib/checkinSession';
import {
  markTrophyPromptShown,
  shouldShowTrophyPrompt,
} from '@/lib/trophyPrompt';

type PlaceWithDistance = Place & { distanceM: number | null };

type ActionKind = 'checkin' | 'update' | 'too_far' | 'busy' | 'no_gps';

function resolveAction(
  place: PlaceWithDistance,
  session: CheckInSession | null
): ActionKind {
  if (session && session.placeId === place.id) return 'update';
  if (session && session.placeId !== place.id) return 'busy';
  if (place.distanceM == null) return 'no_gps';
  if (place.distanceM > GRAINS_PROXIMITY_M) return 'too_far';
  return 'checkin';
}

function actionLabel(kind: ActionKind): string {
  switch (kind) {
    case 'update':
      return 'Mettre à jour';
    case 'too_far':
      return 'Trop loin';
    case 'busy':
      return 'Session ailleurs';
    case 'no_gps':
      return 'GPS requis';
    default:
      return 'Check-in';
  }
}

function actionClasses(kind: ActionKind): string {
  switch (kind) {
    case 'update':
    case 'checkin':
      return 'bg-ds-ok text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md hover:bg-ds-ok/90 active:scale-95 transition-all';
    case 'too_far':
    case 'busy':
    case 'no_gps':
      return 'bg-gray-100 text-gray-400 cursor-not-allowed font-bold text-sm px-4 py-2.5 rounded-xl';
  }
}

export default function CheckInPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithDistance | null>(
    null
  );
  const [trophyPlace, setTrophyPlace] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [grains, setGrains] = useState(0);
  const [vibes, setVibes] = useState<Record<string, AggregatedVibe>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [session, setSession] = useState<CheckInSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setGrains(getGrainsBalance());
    setSession(getActiveSession());
  }, []);

  // Refresh session expiry clock while a session is open.
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      const active = getActiveSession();
      setSession(active);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [session]);

  const loadPlacesAndVibes = useCallback(async () => {
    setPlacesLoading(true);
    try {
      const [placesData, vibesData] = await Promise.all([
        getPlaces().catch((err) => {
          console.error('Error loading places:', err);
          return [] as Place[];
        }),
        getAggregatedVibes().catch(() => ({}) as Record<string, AggregatedVibe>),
      ]);
      setPlaces(placesData);
      setVibes(vibesData);
    } finally {
      setPlacesLoading(false);
    }
  }, []);

  const locateGps = useCallback(async () => {
    setGpsLoading(true);
    setGpsDenied(false);
    const geo = await getCurrentPosition();
    if (!geo.ok) {
      setUserCoords(null);
      setGpsDenied(geo.reason === 'denied');
      setGpsLoading(false);
      return;
    }
    setUserCoords(geo.coords);
    setGpsLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void loadPlacesAndVibes();
    void locateGps();
  }, [authLoading, loadPlacesAndVibes, locateGps]);

  const rankedPlaces = useMemo((): PlaceWithDistance[] => {
    const list = places.map((p) => {
      if (!userCoords || !hasValidCoordinates(p)) {
        return { ...p, distanceM: null as number | null };
      }
      return {
        ...p,
        distanceM: distanceMeters(userCoords, { lat: p.lat, lng: p.lng }),
      };
    });

    return list.sort((a, b) => {
      if (a.distanceM == null && b.distanceM == null) return 0;
      if (a.distanceM == null) return 1;
      if (b.distanceM == null) return -1;
      return a.distanceM - b.distanceM;
    });
  }, [places, userCoords]);

  const nearbyPlaces = useMemo(
    () =>
      rankedPlaces.filter(
        (p) => p.distanceM != null && p.distanceM <= GRAINS_PROXIMITY_M
      ),
    [rankedPlaces]
  );

  const searching = searchQuery.trim().length > 0;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return rankedPlaces
      .filter((p) =>
        [p.name, p.address, p.city, p.category]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [rankedPlaces, searchQuery]);

  const handlePlacePress = (place: PlaceWithDistance) => {
    const action = resolveAction(place, session);
    if (action === 'too_far' || action === 'busy' || action === 'no_gps') {
      if (action === 'too_far') setToast('Trop loin — rapproche-toi à moins de 100 m');
      if (action === 'busy')
        setToast(`Session active à ${session?.placeName ?? 'un autre spot'}`);
      if (action === 'no_gps')
        setToast('Active le GPS pour check-in et gagner des Grains');
      window.setTimeout(() => setToast(null), 2800);
      return;
    }
    setSelectedPlace(place);
  };

  const handleEndSession = () => {
    clearCheckInSession();
    setSession(null);
    setToast('Session terminée — tu peux check-in ailleurs');
    window.setTimeout(() => setToast(null), 2800);
  };

  const handleSubmitted = () => {
    setGrains(getGrainsBalance());
    setSession(getActiveSession());
    void getAggregatedVibes().then(setVibes);
  };

  const handleSuccessDismiss = (place: { id: string; name: string }) => {
    if (isAuthenticated && shouldShowTrophyPrompt()) {
      markTrophyPromptShown();
      setTrophyPlace(place);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ds-ok" />
      </div>
    );
  }

  const remaining =
    session != null ? formatSessionRemaining(sessionRemainingMs(session, now)) : null;

  return (
    <div className="flex-1 pb-24">
      <Header grains={grains} />

      <div className="px-5 mt-1">
        {session && (
          <div className="mb-4 rounded-2xl border border-ds-ok/25 bg-ds-ok/8 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-ok">
              Session active
            </p>
            <p className="text-sm font-extrabold text-ds-text mt-0.5">
              {session.placeName}
            </p>
            <p className="text-[11px] text-ds-text2 mt-0.5">
              Expire dans {remaining}
            </p>
            <button
              type="button"
              onClick={handleEndSession}
              className="mt-2.5 text-xs font-bold text-ds-accent hover:underline"
            >
              Terminer ma session
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 bg-ds-surface rounded-2xl px-4 py-3 shadow-sm border border-ds-text2/10 focus-within:border-ds-ok/40 transition-all">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="text-ds-text2 flex-shrink-0"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Chercher un café…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ds-text placeholder:text-ds-text2/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer"
                className="text-ds-text2/60 hover:text-ds-text"
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void locateGps()}
            aria-label="Actualiser le GPS"
            className="w-11 h-11 flex-shrink-0 rounded-2xl bg-ds-surface border border-ds-text2/10 flex items-center justify-center text-ds-ok shadow-sm active:scale-95 transition-all"
          >
            <Crosshair
              size={20}
              weight="bold"
              className={gpsLoading ? 'animate-pulse' : ''}
            />
          </button>
        </div>

        {!gpsLoading && gpsDenied && (
          <p className="mt-2 text-[11px] text-ds-text2">
            GPS refusé — active-le pour check-in à proximité.
          </p>
        )}

        <div className="mt-4 space-y-5">
          {/* Skeletons pendant chargement spots ou init GPS */}
          {!searching && (placesLoading || gpsLoading) ? (
            <NearbySpotsSkeleton />
          ) : searching ? (
            <section>
              <h2 className="text-sm font-extrabold text-ds-text mb-2.5">
                Résultats
              </h2>
              {placesLoading ? (
                <NearbySpotsSkeleton hideTitle />
              ) : searchResults.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2.5">
                  {searchResults.map((place) => (
                    <PlaceRow
                      key={place.id}
                      place={place}
                      vibe={vibes[place.id]}
                      action={resolveAction(place, session)}
                      highlight={
                        place.distanceM != null &&
                        place.distanceM <= GRAINS_PROXIMITY_M
                      }
                      onPress={() => handlePlacePress(place)}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {nearbyPlaces.length > 0 && (
                <section>
                  <h2 className="text-sm font-extrabold text-ds-text mb-2.5 flex items-center gap-1.5">
                    <span aria-hidden>📍</span> Autour de toi
                    <span className="text-[11px] font-semibold text-ds-text2">
                      ({nearbyPlaces.length})
                    </span>
                  </h2>
                  <div className="space-y-2.5">
                    {nearbyPlaces.map((place) => (
                      <PlaceRow
                        key={place.id}
                        place={place}
                        vibe={vibes[place.id]}
                        action={resolveAction(place, session)}
                        highlight
                        onPress={() => handlePlacePress(place)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {userCoords && nearbyPlaces.length === 0 && (
                <p className="text-sm text-ds-text2 text-center py-2">
                  Aucun café à moins de 100 m — rapproche-toi ou ajoute un spot.
                </p>
              )}

              <MissingSpotCard
                onPress={() => {
                  setToast('Ajout de spot bientôt disponible — merci !');
                  window.setTimeout(() => setToast(null), 2800);
                }}
              />
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 w-[min(92vw,22rem)] rounded-2xl bg-ds-pin text-white px-4 py-3 shadow-xl text-center text-sm font-bold">
          {toast}
        </div>
      )}

      {selectedPlace && (
        <CheckInModal
          place={selectedPlace}
          isAuthenticated={isAuthenticated}
          distanceM={selectedPlace.distanceM}
          isActiveSession={session?.placeId === selectedPlace.id}
          onClose={() => setSelectedPlace(null)}
          onSubmitted={handleSubmitted}
          onSuccessDismiss={handleSuccessDismiss}
        />
      )}

      {trophyPlace && (
        <TrophyModal
          place={trophyPlace}
          onClose={() => setTrophyPlace(null)}
          onVoted={() => {
            setToast('Merci ! 🎉');
            window.setTimeout(() => setToast(null), 2800);
          }}
        />
      )}
    </div>
  );
}

function PlaceRow({
  place,
  vibe,
  action,
  highlight = false,
  onPress,
}: {
  place: PlaceWithDistance;
  vibe?: AggregatedVibe;
  action: ActionKind;
  highlight?: boolean;
  onPress: () => void;
}) {
  const disabled =
    action === 'too_far' || action === 'busy' || action === 'no_gps';

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`w-full text-left flex items-center gap-3 rounded-2xl p-2.5 transition-all ${
        highlight
          ? 'bg-ds-ok/5 border border-ds-ok/20 hover:border-ds-ok/40'
          : 'bg-white border border-gray-100 opacity-80'
      } ${disabled ? 'cursor-not-allowed' : 'active:scale-[0.99]'}`}
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-ds-bg">
        {place.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image_url}
            alt=""
            className={`w-full h-full object-cover ${
              highlight ? '' : 'grayscale-[30%]'
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Coffee size={22} weight="duotone" className="text-ds-text2/40" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ds-text text-sm truncate">
          {place.name}
        </p>
        <p className="text-[11px] text-ds-text2 truncate mt-0.5">
          {vibe ? formatVibeSummary(vibe) : 'Aucune vibe récente'}
        </p>
        {place.distanceM != null && (
          <p className="text-[10px] text-ds-text2/70 mt-0.5">
            {formatDistance(place.distanceM)}
          </p>
        )}
      </div>
      <span
        className={`flex-shrink-0 text-[11px] max-w-[7.5rem] text-center leading-tight ${actionClasses(action)}`}
      >
        {actionLabel(action)}
      </span>
    </button>
  );
}

/** Carte fantôme — même structure qu'une PlaceRow (image + textes + bouton). */
function PlaceRowSkeleton() {
  return (
    <div
      className="w-full flex items-center gap-3 rounded-2xl p-2.5 border border-ds-ok/10 bg-ds-ok/[0.03] animate-pulse"
      aria-hidden
    >
      <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-36 max-w-full rounded-full bg-gray-100" />
        <div className="h-2.5 w-28 max-w-[80%] rounded-full bg-gray-100" />
        <div className="h-2 w-14 rounded-full bg-gray-100" />
      </div>
      <div className="h-9 w-[5.5rem] rounded-xl bg-gray-100 flex-shrink-0" />
    </div>
  );
}

function NearbySpotsSkeleton({ hideTitle = false }: { hideTitle?: boolean }) {
  return (
    <section aria-busy="true" aria-label="Chargement des spots à proximité">
      {!hideTitle && (
        <div className="mb-2.5 flex items-center gap-2">
          <div className="h-4 w-28 rounded-full bg-gray-100 animate-pulse" />
          <div className="h-3 w-8 rounded-full bg-gray-100 animate-pulse" />
        </div>
      )}
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <PlaceRowSkeleton key={i} />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] font-medium text-ds-text2 flex items-center justify-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-ds-ok animate-pulse" />
        Recherche des spots autour de toi…
      </p>
    </section>
  );
}

function MissingSpotCard({ onPress }: { onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full border-2 border-dashed border-gray-300 bg-gray-50/50 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-gray-50 hover:border-ds-ok/50 cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm flex-shrink-0">
          <Storefront size={20} weight="duotone" />
        </div>
        <div className="text-left min-w-0">
          <p className="font-bold text-ds-pin text-sm">Spot manquant ?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Ajoute-le et gagne des Grains
          </p>
        </div>
      </div>
      <span
        className="w-8 h-8 rounded-full bg-ds-pin text-white flex items-center justify-center shadow-md flex-shrink-0"
        aria-hidden
      >
        <Plus size={16} weight="bold" />
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-10">
      <Coffee size={32} weight="duotone" className="text-ds-text2/40 mx-auto mb-3" />
      <p className="font-semibold text-ds-text">Aucun résultat</p>
      <p className="text-sm text-ds-text2 mt-1">Essaie un autre nom.</p>
    </div>
  );
}

function Header({ grains }: { grains: number }) {
  return (
    <div className="px-5 pt-6 pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-ds-text tracking-tight">
          Check-in
        </h1>
        <p className="text-sm text-ds-text2 mt-1">
          Confirme ta présence et gagne des Grains.
        </p>
      </div>
      <Link
        href="/profile"
        className="flex-shrink-0 inline-flex items-center gap-1.5 bg-amber-100 border border-amber-200 text-amber-700 font-bold px-3 py-1.5 rounded-full active:scale-95 transition-all"
      >
        <span className="text-sm" aria-hidden>
          🌾
        </span>
        <span className="text-sm tabular-nums">{grains}</span>
      </Link>
    </div>
  );
}
