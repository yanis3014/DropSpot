'use client';

import { useEffect, useState } from 'react';
import { MapPin, LockKey, WifiHigh, Plugs, SpeakerHigh, Laptop, Lightning } from '@phosphor-icons/react';
import CheckInModal from '@/components/spots/CheckInModal';
import FavoriteButton from '@/components/places/FavoriteButton';
import LoginModal from '@/components/auth/LoginModal';
import { useAuth } from '@/lib/hooks/useAuth';
import { Place } from '@/lib/api/places';
import { getSavedPlaceIds, savePlace, unsavePlace } from '@/lib/api/saved';
import { openDirections } from '@/lib/utils/directions';

interface PlaceDetailsProps {
  place: Place;
}

export default function PlaceDetails({ place }: PlaceDetailsProps) {
  const { isAuthenticated } = useAuth();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getSavedPlaceIds()
      .then(setSavedIds)
      .catch((error) => console.error('Error fetching saved place ids:', error));
  }, [isAuthenticated, place.id]);

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

  const mockMetrics = [
    {
      icon: WifiHigh,
      label: 'Wi-Fi',
      value: place.wifi_speed || '120 Mbps',
    },
    {
      icon: Plugs,
      label: 'Prises',
      value: place.has_plugs ? 'Disponibles' : 'Limitées',
    },
    {
      icon: SpeakerHigh,
      label: 'Ambiance',
      value: place.noise_level || 'Calme',
    },
    {
      icon: Laptop,
      label: 'Laptop',
      value: place.laptop_policy || 'Autorisé',
    },
  ];

  return (
    <div className="bg-brand-surface rounded-2xl shadow-sm overflow-hidden">
      {/* Public Section */}
      <div className="relative">
        {/* Place Image */}
        <div className="relative w-full h-48 bg-brand-oat rounded-t-2xl overflow-hidden">
          {place.image_url ? (
            <img
              src={place.image_url}
              alt={place.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand-oat">
              <span className="text-brand-mocha text-sm">Image non disponible</span>
            </div>
          )}
          <FavoriteButton
            placeId={place.id}
            isSaved={savedIds.includes(place.id)}
            onToggle={handleToggleSave}
            size={18}
            className="absolute top-3 right-3 w-9 h-9"
          />
        </div>

        {/* Place Name */}
        <div className="p-4">
          <h2 className="text-2xl font-extrabold text-brand-espresso tracking-tight mb-4">
            {place.name}
          </h2>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => openDirections(place)}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-oat text-brand-espresso rounded-xl py-3 font-semibold shadow-sm hover:bg-brand-oat/80 active:scale-95 transition-all">
              <MapPin size={20} weight="fill" />
              <span>S'y rendre</span>
            </button>
            <button
              onClick={() => setShowCheckIn(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-ink text-white rounded-xl py-3 font-semibold shadow-sm hover:bg-brand-ink/90 active:scale-95 transition-all"
            >
              <Lightning size={20} weight="fill" />
              <span>Checker</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expert Data Section (Soft-Gate) */}
      <div className="p-4 border-t border-brand-mocha/10">
        <h3 className="text-lg font-semibold text-brand-espresso mb-4">Infos pratiques</h3>
        
        <div className="relative overflow-hidden rounded-xl">
          {/* Metrics Container */}
          <div
            className={`space-y-3 ${
              !isAuthenticated
                ? 'blur-sm opacity-40 select-none pointer-events-none'
                : ''
            }`}
          >
            {mockMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="flex items-center gap-3 p-3 bg-brand-oat rounded-lg"
                >
                  <Icon size={24} weight="duotone" className="text-brand-mocha" />
                  <div className="flex-1">
                    <p className="text-xs text-brand-mocha font-medium">{metric.label}</p>
                    <p className="text-sm font-semibold text-brand-espresso">{metric.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Soft-Gate Overlay (for non-authenticated users) */}
          {!isAuthenticated && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-brand-oat/60 backdrop-blur-[2px]">
              <LockKey weight="duotone" size={32} className="text-brand-terracotta mb-2" />
              <p className="text-sm text-center font-medium text-brand-espresso mb-4">
                Crée un compte gratuit pour voir le débit Wi-Fi, l&apos;accès aux prises et le niveau sonore.
              </p>
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="bg-brand-matcha text-white w-full rounded-xl py-3 font-semibold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <LockKey size={20} weight="fill" />
                <span>Déverrouiller l&apos;accès</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Check-in modal */}
      {showCheckIn && (
        <CheckInModal
          place={{ id: place.id, name: place.name, image_url: place.image_url }}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowCheckIn(false)}
        />
      )}

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
