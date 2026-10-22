'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spinner } from '@phosphor-icons/react';
import PlaceDetailView from '@/components/places/PlaceDetailView';
import { getPlaceById, Place } from '@/lib/api/places';
import { getPlaceMedia, type PlaceMedia } from '@/lib/api/placeMedia';
import { getPlaceVibe, type AggregatedVibe } from '@/lib/api/checkins';
import { getPlaceDrops, type Drop } from '@/lib/api/drops';
import { getSavedPlaceIds, savePlace, unsavePlace } from '@/lib/api/saved';
import { useAuth } from '@/lib/hooks/useAuth';

export default function PlacePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { isAuthenticated, loading: authLoading } = useAuth();
  const [place, setPlace] = useState<Place | null>(null);
  const [media, setMedia] = useState<PlaceMedia[]>([]);
  const [vibe, setVibe] = useState<AggregatedVibe | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Identifiant manquant');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [fresh, placeVibe, placeMedia, placeDrops] = await Promise.all([
          getPlaceById(id),
          getPlaceVibe(id).catch(() => null),
          getPlaceMedia(id).catch(() => [] as PlaceMedia[]),
          getPlaceDrops(id).catch(() => [] as Drop[]),
        ]);
        if (cancelled) return;
        if (!fresh) {
          setPlace(null);
          setMedia([]);
          setError('Café introuvable');
        } else {
          setPlace(fresh);
          setMedia(placeMedia);
          setVibe(placeVibe);
          setDrops(placeDrops);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger ce café'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setSavedIds([]);
      return;
    }
    getSavedPlaceIds()
      .then(setSavedIds)
      .catch((err) => console.error('Error loading saved places:', err));
  }, [isAuthenticated, authLoading]);

  const handleToggleSave = useCallback(
    async (placeId: string) => {
      if (!isAuthenticated) return;
      const currentlySaved = savedIds.includes(placeId);
      setSavedIds((prev) =>
        currentlySaved
          ? prev.filter((x) => x !== placeId)
          : [...prev, placeId]
      );
      try {
        if (currentlySaved) await unsavePlace(placeId);
        else await savePlace(placeId);
      } catch (err) {
        console.error(err);
        setSavedIds((prev) =>
          currentlySaved
            ? [...prev, placeId]
            : prev.filter((x) => x !== placeId)
        );
      }
    },
    [isAuthenticated, savedIds]
  );

  const refreshVibe = useCallback(async () => {
    if (!id) return;
    try {
      setVibe(await getPlaceVibe(id));
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-3 bg-ds-bg">
        <Spinner size={28} className="animate-spin text-ds-ok" />
        <p className="text-sm text-ds-text2">Chargement du café…</p>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-4 px-6 bg-ds-bg text-center">
        <p className="text-base font-bold text-ds-text">
          {error ?? 'Café introuvable'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/map')}
          className="rounded-xl bg-ds-pin text-white font-bold text-sm px-5 py-3 active:scale-[0.98] transition-all"
        >
          Retour à la carte
        </button>
      </div>
    );
  }

  return (
    <PlaceDetailView
      key={place.id}
      place={place}
      media={media}
      vibe={vibe}
      drops={drops}
      isAuthenticated={isAuthenticated}
      isSaved={savedIds.includes(place.id)}
      onToggleSave={handleToggleSave}
      onCheckedIn={refreshVibe}
      backHref="/map"
    />
  );
}
