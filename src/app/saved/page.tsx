'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Coffee,
  MapPin,
  WifiHigh,
  Plugs,
  SunDim,
  Leaf,
  LockKey,
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSavedPlaces, unsavePlace, SavedPlace } from '@/lib/api/saved';
import LoginModal from '@/components/auth/LoginModal';

export default function SavedPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      if (!loading) setFetching(false);
      return;
    }
    const load = async () => {
      try {
        setFetching(true);
        setSaved(await getSavedPlaces());
      } catch (error) {
        console.error('Error loading saved places:', error);
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [loading, isAuthenticated]);

  const handleUnsave = async (placeId: string) => {
    // Optimistic removal
    setSaved((prev) => prev.filter((s) => s.place_id !== placeId));
    try {
      await unsavePlace(placeId);
    } catch (error) {
      console.error('Error removing favorite:', error);
      // Reload on failure to restore accurate state
      setSaved(await getSavedPlaces());
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex-1 flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-matcha"></div>
      </div>
    );
  }

  /* Guest soft-gate */
  if (!isAuthenticated) {
    return (
      <div className="flex-1 pb-24 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-brand-terracotta/10 flex items-center justify-center mb-5">
          <LockKey size={32} weight="duotone" className="text-brand-terracotta" />
        </div>
        <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight mb-2">
          Tes spots favoris t'attendent
        </h1>
        <p className="text-sm text-brand-mocha mb-8 max-w-[280px]">
          Connecte-toi pour retrouver tous les cafés que tu as enregistrés.
        </p>
        <button
          onClick={() => setShowLogin(true)}
          className="w-full max-w-xs bg-brand-ink text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-brand-ink/90 active:scale-[0.98] transition-all"
        >
          Se connecter
        </button>
        <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
      </div>
    );
  }

  return (
    <div className="flex-1 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
          Mes spots favoris ❤️
        </h1>
        {saved.length > 0 && (
          <p className="text-sm text-brand-mocha mt-1">
            {saved.length} spot{saved.length > 1 ? 's' : ''} enregistré{saved.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {saved.length === 0 ? (
        /* Empty state */
        <div className="px-5">
          <div className="bg-brand-surface rounded-3xl border border-dashed border-brand-mocha/20 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-oat flex items-center justify-center mx-auto mb-4">
              <Heart size={32} weight="duotone" className="text-brand-mocha/50" />
            </div>
            <p className="font-bold text-brand-espresso mb-1">
              Aucun favori pour l'instant
            </p>
            <p className="text-sm text-brand-mocha max-w-[260px] mx-auto mb-6">
              Explore la carte ou le feed pour enregistrer tes spots préférés !
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => router.push('/')}
                className="bg-brand-ink text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm hover:bg-brand-ink/90 active:scale-95 transition-all"
              >
                Voir le feed
              </button>
              <button
                onClick={() => router.push('/map')}
                className="bg-brand-surface text-brand-espresso text-sm font-bold px-5 py-2.5 rounded-full border border-brand-mocha/15 hover:border-brand-espresso/25 active:scale-95 transition-all"
              >
                Explorer la carte
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Saved places list */
        <div className="px-5 space-y-3">
          {saved.map((item) => {
            const place = item.places;
            if (!place) return null;

            return (
              <div
                key={item.id}
                className="group bg-brand-surface rounded-2xl shadow-sm hover:shadow-md transition-all p-3 border border-brand-mocha/5"
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
                    {/* Unsave heart */}
                    <button
                      onClick={() => handleUnsave(place.id)}
                      aria-label="Retirer des favoris"
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-brand-surface/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-brand-surface active:scale-90 transition-all"
                    >
                      <Heart size={15} weight="fill" className="text-brand-terracotta" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0 py-0.5">
                    <h4 className="font-bold text-brand-espresso mb-0.5 truncate">
                      {place.name}
                    </h4>
                    {place.address && (
                      <p className="flex items-center gap-1 text-xs text-brand-mocha mb-2.5 truncate">
                        <MapPin size={11} weight="fill" className="flex-shrink-0" />
                        {place.address}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
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
  );
}
