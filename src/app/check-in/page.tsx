'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Coffee,
  MagnifyingGlass,
  Crosshair,
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
      return 'bg-brand-matcha text-white';
    case 'checkin':
      return 'bg-brand-matcha/10 text-brand-matcha';
    case 'too_far':
    case 'busy':
    case 'no_gps':
      return 'bg-brand-muted text-brand-mocha';
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
  const [visibleOtherSpots, setVisibleOtherSpots] = useState(10);

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

  const otherPlaces = useMemo(() => {
    const nearbyIds = new Set(nearbyPlaces.map((p) => p.id));
    return rankedPlaces.filter((p) => !nearbyIds.has(p.id));
  }, [rankedPlaces, nearbyPlaces]);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-matcha" />
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
          <div className="mb-4 rounded-2xl border border-brand-matcha/25 bg-brand-matcha/8 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-matcha">
              Session active
            </p>
            <p className="text-sm font-extrabold text-brand-espresso mt-0.5">
              {session.placeName}
            </p>
            <p className="text-[11px] text-brand-mocha mt-0.5">
              Expire dans {remaining}
            </p>
            <button
              type="button"
              onClick={handleEndSession}
              className="mt-2.5 text-xs font-bold text-brand-terracotta hover:underline"
            >
              Terminer ma session
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 bg-brand-surface rounded-2xl px-4 py-3 shadow-sm border border-brand-mocha/10 focus-within:border-brand-matcha/40 transition-all">
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
          <button
            type="button"
            onClick={() => void locateGps()}
            aria-label="Actualiser le GPS"
            className="w-11 h-11 flex-shrink-0 rounded-2xl bg-brand-surface border border-brand-mocha/10 flex items-center justify-center text-brand-matcha shadow-sm active:scale-95 transition-all"
          >
            <Crosshair
              size={20}
              weight="bold"
              className={gpsLoading ? 'animate-pulse' : ''}
            />
          </button>
        </div>

        {gpsLoading && (
          <p className="mt-2 text-[11px] font-medium text-brand-mocha flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-matcha animate-pulse" />
            Localisation en cours…
          </p>
        )}
        {!gpsLoading && gpsDenied && (
          <p className="mt-2 text-[11px] text-brand-mocha">
            GPS refusé — active-le pour check-in à proximité.
          </p>
        )}

        <div className="mt-4 space-y-5">
          {placesLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-[76px] rounded-2xl bg-brand-espresso/[0.04] animate-pulse"
                />
              ))}
            </div>
          ) : searching ? (
            <section>
              <h2 className="text-sm font-extrabold text-brand-espresso mb-2.5">
                Résultats
              </h2>
              {searchResults.length === 0 ? (
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
                  <h2 className="text-sm font-extrabold text-brand-espresso mb-2.5 flex items-center gap-1.5">
                    <span aria-hidden>📍</span> Autour de toi
                    <span className="text-[11px] font-semibold text-brand-mocha">
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

              {!gpsLoading &&
                userCoords &&
                nearbyPlaces.length === 0 && (
                  <p className="text-sm text-brand-mocha text-center py-2">
                    Aucun café à moins de 100 m — cherche un spot ou rapproche-toi.
                  </p>
                )}

              {otherPlaces.length > 0 && (
                <section>
                  <h2 className="text-sm font-extrabold text-brand-espresso mb-2.5">
                    Autres spots
                  </h2>
                  <div className="space-y-2.5">
                    {otherPlaces.slice(0, visibleOtherSpots).map((place) => (
                      <PlaceRow
                        key={place.id}
                        place={place}
                        vibe={vibes[place.id]}
                        action={resolveAction(place, session)}
                        onPress={() => handlePlacePress(place)}
                      />
                    ))}
                  </div>
                  {otherPlaces.length > visibleOtherSpots && (
                    <button
                      type="button"
                      onClick={() => setVisibleOtherSpots((prev) => prev + 10)}
                      className="w-full py-3 mt-2 text-sm font-medium text-brand-mocha bg-brand-muted rounded-xl active:scale-95 transition-all hover:text-brand-espresso"
                    >
                      Voir plus
                    </button>
                  )}
                </section>
              )}

              {!placesLoading &&
                nearbyPlaces.length === 0 &&
                otherPlaces.length === 0 && <EmptyState />}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 w-[min(92vw,22rem)] rounded-2xl bg-brand-ink text-white px-4 py-3 shadow-xl text-center text-sm font-bold">
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
      className={`w-full text-left rounded-2xl p-3 flex items-center gap-3 shadow-sm transition-all ${
        highlight
          ? 'border-2 border-brand-matcha/35 bg-brand-matcha/5 shadow-brand-matcha/10'
          : 'border border-brand-mocha/8 bg-brand-surface'
      } ${
        disabled
          ? 'opacity-70 cursor-not-allowed'
          : 'hover:shadow-md active:scale-[0.99]'
      }`}
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
            <Coffee size={22} weight="duotone" className="text-brand-mocha/40" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-brand-espresso text-sm truncate">
          {place.name}
        </p>
        <p className="text-[11px] text-brand-mocha truncate mt-0.5">
          {vibe ? formatVibeSummary(vibe) : 'Aucune vibe récente'}
        </p>
        {place.distanceM != null && (
          <p className="text-[10px] text-brand-mocha/70 mt-0.5">
            {formatDistance(place.distanceM)}
          </p>
        )}
      </div>
      <span
        className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-2 rounded-full max-w-[7.5rem] text-center leading-tight ${actionClasses(action)}`}
      >
        {actionLabel(action)}
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-10">
      <Coffee size={32} weight="duotone" className="text-brand-mocha/40 mx-auto mb-3" />
      <p className="font-semibold text-brand-espresso">Aucun résultat</p>
      <p className="text-sm text-brand-mocha mt-1">Essaie un autre nom.</p>
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
