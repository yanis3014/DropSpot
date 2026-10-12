'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DropDetailModal from '@/components/drops/DropDetailModal';
import { useAuth } from '@/lib/hooks/useAuth';
import { getPlaces, Place } from '@/lib/api/places';
import { getActiveDrops, getDropTiming, Drop, formatCountdown } from '@/lib/api/drops';
import { peekCache } from '@/lib/cache/clientCache';
import { getLatestVibes, CheckIn } from '@/lib/api/checkins';
import { getSavedPlaceIds, savePlace, unsavePlace } from '@/lib/api/saved';
import PlaceDetailModal from '@/components/spots/PlaceDetailModal';
import ProfileSheet from '@/components/profile/ProfileSheet';
import LoginModal from '@/components/auth/LoginModal';
import { useProfile } from '@/lib/hooks/useProfile';
import { needsOnboarding } from '@/lib/api/profiles';
import { dropMatchesFilter, placeMatchesFilter } from '@/lib/filters';
import {
  dropMatches,
  placeMatches,
  PreferenceId,
} from '@/lib/preferences';
import FilterSheet from '@/components/layout/FilterSheet';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/layout/SearchBar';
import FilterButton from '@/components/layout/FilterButton';
import DropSection from '@/components/layout/DropSection';
import SpotCarousel from '@/components/layout/SpotCarousel';

type CategoryFilter = 'all' | 'promo' | 'sport' | 'event' | 'remote' | 'bakery';
type TimingFilter = 'all' | 'live' | 'upcoming' | 'ended';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading, email, avatarUrl, displayName, signOut } = useAuth();
  const { profile, loading: profileLoading, save: saveProfile } = useProfile(isAuthenticated, loading);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [places, setPlaces] = useState<Place[]>(() => {
    const cached = peekCache<Place[]>('places:full');
    return cached ? cached.slice(0, 6) : [];
  });
  const [placesLoading, setPlacesLoading] = useState(() => !peekCache('places:full'));
  const [vibes, setVibes] = useState<Record<string, CheckIn>>({});
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [drops, setDrops] = useState<Drop[]>(
    () => peekCache<Drop[]>('drops:active') ?? []
  );
  const [dropsLoading, setDropsLoading] = useState(() => !peekCache('drops:active'));
  const [now, setNow] = useState<number>(() => Date.now());
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timingFilter, setTimingFilter] = useState<TimingFilter>('all');
  const [region, setRegion] = useState<string>('all');
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
    .filter((d) => timingFilter === 'all' || getDropTiming(d, now) === timingFilter)
    .filter(
      (d) =>
        !query ||
        [d.title, d.description, d.places?.name].some((f) =>
          f?.toLowerCase().includes(query)
        )
    )
    .sort(byMatchCount(dropMatchMap));

  const filteredPlaces = places
    .filter((p) => placeMatchesFilter(p, category))
    .filter((p) => region === 'all' || p.city === region)
    .filter(
      (p) =>
        !query ||
        [p.name, p.address, p.description, p.category].some((f) =>
          f?.toLowerCase().includes(query)
        )
    )
    .sort(byMatchCount(placeMatchMap));

  return (
    <div className="flex-1 pb-24">
      {/* ====================== EN-TÊTE ====================== */}
      <Header
        isAuthenticated={isAuthenticated}
        email={email ?? undefined}
        avatarUrl={avatarUrl ?? undefined}
        displayName={displayName ?? undefined}
        userPrefs={userPrefs}
        onShowProfile={() => setShowProfile(true)}
        onShowLogin={() => setShowLogin(true)}
      />

      {/* ====================== BARRE DE RECHERCHE + BOUTON FILTRES ====================== */}
      <div className="px-5 mb-8 flex gap-3">
        <SearchBar
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
        />
        <FilterButton onClick={() => setShowFilters(true)} />
      </div>

      {/* ====================== SECTION DROPS ====================== */}
      <DropSection
        drops={filteredDrops}
        dropsLoading={dropsLoading}
        claimedDrops={claimedDrops}
        now={now}
        onOpenDrop={(drop) => setSelectedDrop(drop)}
      />

      {/* ====================== SECTION SPOTS TENDANCES ====================== */}
      <SpotCarousel
        places={filteredPlaces}
        placesLoading={placesLoading}
        vibes={vibes}
        savedIds={savedIds}
        onToggleSave={handleToggleSave}
        onOpenPlace={(place) => setSelectedPlace(place)}
      />

      {/* ====================== FILTRES SHEET ====================== */}
      <FilterSheet
        open={showFilters}
        categoryFilter={category}
        timingFilter={timingFilter}
        region={region}
        regions={Array.from(new Set(places.map((p) => p.city ?? '').filter(Boolean)))}
        onCategoryChange={setCategory}
        onTimingChange={setTimingFilter}
        onRegionChange={setRegion}
        onReset={() => {
          setCategory('all');
          setTimingFilter('all');
          setRegion('all');
        }}
        onClose={() => setShowFilters(false)}
      />

      {/* ====================== MODALES & SHEETS ====================== */}
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
      {showLogin && <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />}
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
    </div>
  );
}
