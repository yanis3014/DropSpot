'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserCircle,
  MapPin,
  WifiHigh,
  Plugs,
  SunDim,
  Leaf,
  Sparkle,
  Coffee,
  MagnifyingGlass,
  X,
  CaretRight,
  NavigationArrow,
} from '@phosphor-icons/react';
import DropDetailModal from '@/components/drops/DropDetailModal';
import DropCard, { ForYouBadge } from '@/components/drops/DropCard';
import SeeMoreDropsCard from '@/components/drops/SeeMoreDropsCard';
import { useAuth } from '@/lib/hooks/useAuth';
import { getPlaces, Place } from '@/lib/api/places';
import { getActiveDrops, Drop, formatCountdown } from '@/lib/api/drops';
import { peekCache } from '@/lib/cache/clientCache';
import { getLatestVibes, crowdConfig, CheckIn } from '@/lib/api/checkins';
import {
  getTopTrophiesForPlaces,
  type PlaceTrophy,
} from '@/lib/api/endorsements';
import TrophyBadge, { mockTrophyForPlace } from '@/components/places/TrophyBadge';
import PepitesCommunSection, {
  buildMockPepites,
} from '@/components/places/PepitesCommunSection';
import { getSavedPlaceIds, savePlace, unsavePlace } from '@/lib/api/saved';
import FavoriteButton from '@/components/places/FavoriteButton';
import PlaceDetailModal from '@/components/spots/PlaceDetailModal';
import ProfileSheet from '@/components/profile/ProfileSheet';
import ThemeCycleButton from '@/components/profile/ThemeCycleButton';
import LoginModal from '@/components/auth/LoginModal';
import { openDirections } from '@/lib/utils/directions';
import { useProfile } from '@/lib/hooks/useProfile';
import { needsOnboarding } from '@/lib/api/profiles';
import { dropMatchesFilter, placeMatchesFilter } from '@/lib/filters';
import {
  dropMatches,
  formatPreferenceList,
  placeMatches,
  preferenceById,
  PreferenceId,
} from '@/lib/preferences';

type CategoryFilter = 'all' | 'promo' | 'sport' | 'event' | 'remote' | 'bakery';

const quickCategories: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: '☕ Tous' },
  { id: 'promo', label: '⚡ Flash Promos' },
  { id: 'sport', label: '🏃‍♂️ Sport' },
  { id: 'remote', label: '💻 Remote Friendly' },
  { id: 'bakery', label: '🥐 Viennoiseries' },
  { id: 'event', label: '🎧 Événements' },
];

const FEED_DROP_LIMIT = 3;

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading, email, avatarUrl, displayName, signOut } = useAuth();
  const { profile, loading: profileLoading, save: saveProfile } = useProfile(isAuthenticated, loading);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [places, setPlaces] = useState<Place[]>(() => {
    const cached = peekCache<Place[]>('places:full');
    return cached ? cached.slice(0, 6) : [];
  });
  const [placesLoading, setPlacesLoading] = useState(
    () => !peekCache('places:full')
  );
  const [vibes, setVibes] = useState<Record<string, CheckIn>>({});
  const [trophies, setTrophies] = useState<Record<string, PlaceTrophy>>({});
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [drops, setDrops] = useState<Drop[]>(
    () => peekCache<Drop[]>('drops:active') ?? []
  );
  const [dropsLoading, setDropsLoading] = useState(
    () => !peekCache('drops:active')
  );
  const [now, setNow] = useState<number>(() => Date.now());
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [claimedDrops, setClaimedDrops] = useState<string[]>([]);

  // Restore claimed drops across refreshes
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dropspot_claims') ?? '[]');
      if (Array.isArray(stored)) setClaimedDrops(stored);
      // Drop the legacy guest-onboarding key if it still exists.
      localStorage.removeItem('dropspot_preference');
    } catch {
      // ignore malformed storage
    }
  }, []);

  // Signed-in users without a finished profile go through /onboarding.
  // Guests land straight on the feed in discovery mode.
  useEffect(() => {
    if (loading || profileLoading || !isAuthenticated) return;
    if (needsOnboarding(profile)) router.replace('/onboarding');
  }, [loading, profileLoading, isAuthenticated, profile, router]);

  // Fetch places
  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        setPlacesLoading(true);
        const [data, vibesData, saved] = await Promise.all([
          getPlaces(),
          getLatestVibes(),
          isAuthenticated ? getSavedPlaceIds() : Promise.resolve([] as string[]),
        ]);
        setPlaces(data.slice(0, 6));
        setVibes(vibesData);
        setSavedIds(saved);
        const ids = data.slice(0, 6).map((p) => p.id);
        if (ids.length) {
          getTopTrophiesForPlaces(ids).then(setTrophies);
        }
      } catch (error) {
        console.error('Error fetching places:', error);
      } finally {
        setPlacesLoading(false);
      }
    };

    fetchPlaces();
  }, [isAuthenticated]);

  // Fetch drops
  useEffect(() => {
    const fetchDrops = async () => {
      try {
        setDropsLoading(true);
        const data = await getActiveDrops();
        setDrops(data);
      } catch (error) {
        console.error('Error fetching drops:', error);
      } finally {
        setDropsLoading(false);
      }
    };

    fetchDrops();
  }, []);

  // Tick every second so every card's countdown stays live
  useEffect(() => {
    if (drops.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [drops.length]);

  const handleClaimDrop = (drop: Drop) => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }

    // Local claim for now - will be persisted to Supabase in a later step
    setClaimedDrops((prev) => {
      const next = [...prev, drop.id];
      localStorage.setItem('dropspot_claims', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleSave = async (placeId: string) => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }

    const isSaved = savedIds.includes(placeId);
    // Optimistic toggle
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
      // Revert optimistic update on failure
      setSavedIds((prev) =>
        isSaved ? [...prev, placeId] : prev.filter((id) => id !== placeId)
      );
    }
  };

  const handleSignOut = async () => {
    setShowProfile(false);
    await signOut();
    router.refresh();
  };

  if (loading || (isAuthenticated && profileLoading)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-matcha"></div>
      </div>
    );
  }

  const userPrefs: PreferenceId[] = profile?.preferences ?? [];
  const prefSummary = formatPreferenceList(userPrefs);

  const greetingText = prefSummary
    ? `Tes spots pour ${prefSummary}`
    : 'Les meilleurs spots pour toi';

  const query = searchQuery.trim().toLowerCase();
  const dropTypeFilter =
    category === 'promo' || category === 'sport' || category === 'event'
      ? category
      : null;

  // Matching drops/places float to the top and get a "Pour toi" badge.
  const dropMatchMap = new Map(drops.map((d) => [d.id, dropMatches(d, userPrefs)]));
  const placeMatchMap = new Map(places.map((p) => [p.id, placeMatches(p, userPrefs)]));
  const byMatchCount =
    (map: Map<string, PreferenceId[]>) =>
    (a: { id: string }, b: { id: string }) =>
      (map.get(b.id)?.length ?? 0) - (map.get(a.id)?.length ?? 0);

  const filteredDrops = drops
    .filter((d) => dropMatchesFilter(d, dropTypeFilter))
    .filter(
      (d) =>
        !query ||
        [d.title, d.description, d.places?.name].some((f) =>
          f?.toLowerCase().includes(query)
        )
    )
    .sort(byMatchCount(dropMatchMap));

  const visiblePlaces = places
    .filter((p) => placeMatchesFilter(p, category))
    .filter(
      (p) =>
        !query ||
        [p.name, p.address, p.description, p.category].some((f) =>
          f?.toLowerCase().includes(query)
        )
    )
    .sort(byMatchCount(placeMatchMap));

  const resolvedName = profile?.full_name || displayName;
  const resolvedAvatar = profile?.avatar_url || avatarUrl;
  const firstName = resolvedName?.split(' ')[0];

  return (
    <div className="flex-1 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-2 flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-sm text-brand-mocha mb-0.5">
            {firstName ? `Bonjour, ${firstName} 👋` : 'Bienvenue 👋'}
          </p>
          <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight leading-tight">
            {greetingText}
          </h1>
        </div>

        {isAuthenticated ? (
          <button
            onClick={() => setShowProfile(true)}
            aria-label="Mon profil"
            title={email ?? undefined}
            className="flex items-center gap-2 bg-brand-surface rounded-full pl-1 pr-3 py-1 shadow-sm border border-brand-mocha/10 hover:shadow-md hover:border-brand-espresso/20 active:scale-95 transition-all flex-shrink-0"
          >
            {resolvedAvatar ? (
              <img
                src={resolvedAvatar}
                alt=""
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <UserCircle size={28} weight="duotone" className="text-brand-matcha" />
            )}
            <span className="text-xs font-semibold text-brand-espresso max-w-[80px] truncate">
              {firstName ?? 'Profil'}
            </span>
            {userPrefs.length > 0 && (
              <span className="text-xs -ml-0.5">
                {userPrefs.slice(0, 2).map((p) => preferenceById[p].emoji).join('')}
              </span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeCycleButton />
            <button
              onClick={() => setShowLogin(true)}
              className="text-sm font-semibold text-brand-matcha bg-brand-matcha/10 px-4 py-2 rounded-full hover:bg-brand-matcha/20 transition-colors"
            >
              Connexion
            </button>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="px-5 mt-3">
        <div className="flex items-center gap-3 bg-brand-surface rounded-2xl px-4 py-3 shadow-sm border border-brand-mocha/10 focus-within:border-brand-matcha/40 focus-within:shadow-md transition-all">
          <MagnifyingGlass
            size={18}
            weight="bold"
            className="text-brand-mocha flex-shrink-0"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un café, un drop, une ambiance..."
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-brand-espresso placeholder:text-brand-mocha/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Effacer la recherche"
              className="flex-shrink-0 text-brand-mocha/60 hover:text-brand-espresso transition-colors"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Quick category pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-pl-5 snap-x snap-mandatory pt-4">
        <div className="w-5 shrink-0" aria-hidden />
        {quickCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`flex-shrink-0 snap-start px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              category === cat.id
                ? 'bg-brand-ink text-white shadow-md shadow-brand-ink/20'
                : 'bg-brand-surface text-brand-mocha border border-brand-mocha/10 hover:border-brand-espresso/25'
            }`}
          >
            {cat.label}
          </button>
        ))}
        <div className="w-4 shrink-0" aria-hidden />
      </div>

      <PepitesCommunSection
        pepites={buildMockPepites(places)}
        onOpenPlace={(id) => {
          const found = places.find((p) => p.id === id);
          if (found) setSelectedPlace(found);
        }}
      />

      {/* À découvrir en ce moment */}
      <div className="mt-5 mb-8">
        <div className="px-5 flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-brand-espresso tracking-tight">
            À découvrir en ce moment
          </h3>
          <button
            onClick={() => router.push('/drops')}
            className="flex items-center gap-0.5 text-xs font-semibold text-brand-matcha hover:text-brand-matcha/80 transition-colors"
          >
            Voir plus
            <CaretRight size={13} weight="bold" />
          </button>
        </div>

        {dropsLoading ? (
          <div className="flex gap-3 overflow-hidden">
            <div className="w-5 shrink-0" aria-hidden />
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-[240px] h-[158px] flex-shrink-0 rounded-2xl bg-brand-espresso/[0.04] animate-pulse"
              />
            ))}
            <div className="w-4 shrink-0" aria-hidden />
          </div>
        ) : drops.length === 0 ? (
          <div className="mx-5 rounded-3xl bg-brand-surface border border-brand-mocha/10 p-6 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-brand-terracotta/10 flex items-center justify-center flex-shrink-0">
              <Sparkle size={26} weight="duotone" className="text-brand-terracotta" />
            </div>
            <div>
              <p className="font-semibold text-brand-espresso">Rien de prévu pour l&apos;instant</p>
              <p className="text-sm text-brand-mocha">
                Les prochains Drops apparaîtront ici. Reste connecté !
              </p>
            </div>
          </div>
        ) : filteredDrops.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-pl-5 snap-x snap-mandatory pb-2">
            <div className="w-5 shrink-0" aria-hidden />
            {filteredDrops.slice(0, FEED_DROP_LIMIT).map((drop) => (
              <DropCard
                key={drop.id}
                drop={drop}
                isClaimed={claimedDrops.includes(drop.id)}
                now={now}
                matches={dropMatchMap.get(drop.id) ?? []}
                onOpen={() => setSelectedDrop(drop)}
              />
            ))}
            <SeeMoreDropsCard />
            <div className="w-4 shrink-0" aria-hidden />
          </div>
        ) : (
          <div className="mx-5 rounded-3xl bg-brand-surface border border-dashed border-brand-mocha/20 p-6 text-center">
            <p className="font-semibold text-brand-espresso mb-1">
              Aucun drop ne correspond
            </p>
            <p className="text-sm text-brand-mocha mb-4">
              Essaie un autre filtre ou une autre recherche.
            </p>
            <button
              onClick={() => router.push('/drops')}
              className="text-sm font-bold text-brand-matcha"
            >
              Voir tous les drops →
            </button>
          </div>
        )}
      </div>

      {/* Cafés tendances */}
      <div className="px-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-lg font-bold text-brand-espresso tracking-tight">
            Cafés tendances
          </h3>
          {visiblePlaces.length > 0 && (
            <span className="text-xs font-medium text-brand-mocha">
              {visiblePlaces.length} spot{visiblePlaces.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {placesLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-brand-surface rounded-2xl shadow-sm p-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-brand-oat rounded-xl flex-shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-4 bg-brand-oat rounded-full animate-pulse w-3/4" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 bg-brand-oat rounded-full animate-pulse" />
                      <div className="h-6 w-20 bg-brand-oat rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : places.length === 0 ? (
          /* Polished empty state when there are no places */
          <div className="text-center py-10 px-6">
            <div className="w-16 h-16 rounded-full bg-brand-oat flex items-center justify-center mx-auto mb-4">
              <Coffee size={32} weight="duotone" className="text-brand-mocha/50" />
            </div>
            <p className="font-semibold text-brand-espresso mb-1">
              Les spots arrivent bientôt
            </p>
            <p className="text-sm text-brand-mocha max-w-[240px] mx-auto">
              Nous préparons une sélection des meilleurs cafés de ta ville.
            </p>
          </div>
        ) : visiblePlaces.length === 0 ? (
          <div className="rounded-3xl bg-brand-surface border border-dashed border-brand-mocha/20 p-6 text-center">
            <p className="font-semibold text-brand-espresso mb-1">
              Aucun café ne correspond
            </p>
            <p className="text-sm text-brand-mocha">
              Essaie un autre filtre ou une autre recherche.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visiblePlaces.map((place) => {
              const vibe = vibes[place.id];
              const crowd = vibe ? crowdConfig[vibe.crowd_level] : null;
              const matches = placeMatchMap.get(place.id) ?? [];
              const trophy = trophies[place.id];

              return (
              <div
                key={place.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPlace(place)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedPlace(place)}
                className={`group bg-brand-surface rounded-2xl shadow-sm hover:shadow-md transition-all p-3 border cursor-pointer active:scale-[0.99] ${
                  matches.length > 0 ? 'border-brand-matcha/40 ring-1 ring-brand-matcha/20' : 'border-brand-mocha/5'
                }`}
              >
                <div className="flex gap-4">
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-brand-oat">
                    {place.image_url ? (
                      <img
                        src={place.image_url}
                        alt={place.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Coffee size={28} weight="duotone" className="text-brand-mocha/40" />
                      </div>
                    )}
                    {/* Save / unsave heart */}
                    <FavoriteButton
                      placeId={place.id}
                      isSaved={savedIds.includes(place.id)}
                      onToggle={handleToggleSave}
                      size={15}
                      className="absolute top-1.5 right-1.5 w-7 h-7"
                    />
                  </div>

                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-brand-espresso mb-0.5 truncate">
                          {place.name}
                        </h4>
                        {trophy ? (
                          <div className="mb-1">
                            <TrophyBadge trophy={trophy} size="sm" />
                          </div>
                        ) : (
                          <div className="mb-1">
                            <TrophyBadge trophy={mockTrophyForPlace(place.id)} size="sm" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDirections(place);
                        }}
                        aria-label={`S'y rendre : ${place.name}`}
                        className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-espresso/5 text-brand-espresso flex items-center justify-center hover:bg-brand-ink hover:text-white active:scale-90 transition-all"
                      >
                        <NavigationArrow size={14} weight="fill" />
                      </button>
                    </div>
                    {place.address && (
                      <p className="text-xs text-brand-mocha mb-2.5 truncate">
                        {place.address}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <ForYouBadge matches={matches} />
                      {crowd && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${crowd.classes}`}
                        >
                          {crowd.emoji} {crowd.label} en ce moment
                        </span>
                      )}
                      {place.has_plugs && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-brand-oat text-brand-mocha rounded-full">
                          <Plugs size={12} weight="duotone" />
                          Prises
                        </span>
                      )}
                      {place.wifi_speed && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-brand-oat text-brand-mocha rounded-full">
                          <WifiHigh size={12} weight="duotone" />
                          {place.wifi_speed}
                        </span>
                      )}
                      {place.noise_level && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-brand-oat text-brand-mocha rounded-full">
                          {place.noise_level}
                        </span>
                      )}
                      {place.has_terrace && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-brand-oat text-brand-mocha rounded-full">
                          <SunDim size={12} weight="duotone" />
                          Terrasse
                        </span>
                      )}
                      {place.is_vegan && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-brand-matcha/10 text-brand-matcha rounded-full">
                          <Leaf size={12} weight="duotone" />
                          Vegan
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drop detail modal */}
      {selectedDrop && (
        <DropDetailModal
          drop={selectedDrop}
          countdown={formatCountdown(selectedDrop.end_time, now)}
          isAuthenticated={isAuthenticated}
          isClaimed={claimedDrops.includes(selectedDrop.id)}
          onClaim={() => handleClaimDrop(selectedDrop)}
          onClose={() => setSelectedDrop(null)}
        />
      )}

      {/* Profile & preferences sheet */}
      {showProfile && (
        <ProfileSheet
          profile={profile}
          email={email}
          fallbackName={displayName}
          fallbackAvatar={avatarUrl}
          onSave={saveProfile}
          onSignOut={handleSignOut}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Place detail modal */}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          vibe={vibes[selectedPlace.id]}
          isAuthenticated={isAuthenticated}
          isSaved={savedIds.includes(selectedPlace.id)}
          onToggleSave={handleToggleSave}
          onCheckedIn={() => getLatestVibes().then(setVibes)}
          onClose={() => setSelectedPlace(null)}
        />
      )}

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
