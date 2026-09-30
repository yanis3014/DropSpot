'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coffee, MapPin, WifiHigh, Lightning } from '@phosphor-icons/react';
import CheckInModal from '@/components/spots/CheckInModal';
import { useAuth } from '@/lib/hooks/useAuth';
import { getPlaces, Place } from '@/lib/api/places';
import { getLatestVibes, crowdConfig, CheckIn } from '@/lib/api/checkins';

export default function CheckInPage() {
  const { isAuthenticated, loading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [vibes, setVibes] = useState<Record<string, CheckIn>>({});
  const [fetching, setFetching] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const load = useCallback(async () => {
    try {
      setFetching(true);
      const [placesData, vibesData] = await Promise.all([getPlaces(), getLatestVibes()]);
      setPlaces(placesData);
      setVibes(vibesData);
    } catch (error) {
      console.error('Error loading check-in page:', error);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) load();
  }, [loading, load]);

  if (loading || fetching) {
    return (
      <div className="flex-1 flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-matcha"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
          Check-in 📍
        </h1>
        <p className="text-sm text-brand-mocha mt-1">
          Tu es sur place ? Partage l'affluence et le Wi-Fi en temps réel.
        </p>
      </div>

      {/* Places list */}
      <div className="px-5 space-y-3">
        {places.length === 0 ? (
          <div className="text-center py-10 px-6">
            <div className="w-16 h-16 rounded-full bg-brand-oat flex items-center justify-center mx-auto mb-4">
              <Coffee size={32} weight="duotone" className="text-brand-mocha/50" />
            </div>
            <p className="font-semibold text-brand-espresso mb-1">
              Aucun spot disponible
            </p>
            <p className="text-sm text-brand-mocha max-w-[240px] mx-auto">
              Les cafés apparaîtront ici dès qu'ils seront en ligne.
            </p>
          </div>
        ) : (
          places.map((place) => {
            const vibe = place.id ? vibes[place.id] : undefined;
            const crowd = vibe ? crowdConfig[vibe.crowd_level] : null;

            return (
              <div
                key={place.id}
                className="bg-white rounded-2xl shadow-sm border border-brand-mocha/5 p-3 flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-brand-oat">
                  {place.image_url ? (
                    <img
                      src={place.image_url}
                      alt={place.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Coffee size={22} weight="duotone" className="text-brand-mocha/40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-brand-espresso text-sm truncate">
                    {place.name}
                  </h4>
                  {crowd ? (
                    <p className={`text-[11px] font-semibold mt-0.5 ${crowd.classes.split(' ')[1]}`}>
                      {crowd.emoji} {crowd.label} en ce moment
                      {vibe?.wifi_speed === 'slow' && ' · Wi-Fi lent 🐌'}
                    </p>
                  ) : (
                    <p className="text-[11px] text-brand-mocha/70 mt-0.5">
                      Aucune vibe récente
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setSelectedPlace(place)}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-brand-espresso text-white text-xs font-bold px-3.5 py-2.5 rounded-full shadow-sm hover:bg-brand-espresso/90 active:scale-95 transition-all"
                >
                  <Lightning size={14} weight="fill" />
                  Checker
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Check-in modal */}
      {selectedPlace && (
        <CheckInModal
          place={selectedPlace}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedPlace(null)}
          onSubmitted={load}
        />
      )}
    </div>
  );
}
