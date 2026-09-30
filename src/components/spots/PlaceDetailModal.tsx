'use client';

import { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Coffee,
  WifiHigh,
  Plugs,
  SpeakerHigh,
  Laptop,
  SunDim,
  Leaf,
  NavigationArrow,
  Lightning,
} from '@phosphor-icons/react';
import FavoriteButton from '@/components/places/FavoriteButton';
import CheckInModal from '@/components/spots/CheckInModal';
import { getPlaceById, Place } from '@/lib/api/places';
import { CheckIn, crowdConfig } from '@/lib/api/checkins';
import { formatAddress, openDirections } from '@/lib/utils/directions';

interface PlaceDetailModalProps {
  place: Place;
  vibe?: CheckIn;
  isAuthenticated: boolean;
  isSaved: boolean;
  onToggleSave: (placeId: string) => void | Promise<void>;
  onCheckedIn?: () => void;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

export default function PlaceDetailModal({
  place: initialPlace,
  vibe,
  isAuthenticated,
  isSaved,
  onToggleSave,
  onCheckedIn,
  onClose,
}: PlaceDetailModalProps) {
  const [visible, setVisible] = useState(false);
  const [place, setPlace] = useState<Place>(initialPlace);
  const [showCheckIn, setShowCheckIn] = useState(false);

  // Slide-in on mount, and lock body scroll while open
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, []);

  // CheckInModal releases the scroll lock when it unmounts
  useEffect(() => {
    if (!showCheckIn) document.body.style.overflow = 'hidden';
  }, [showCheckIn]);

  // The feed may hold a stale or partial row: always read the latest description
  useEffect(() => {
    let cancelled = false;
    getPlaceById(initialPlace.id)
      .then((fresh) => {
        if (!cancelled && fresh) setPlace(fresh);
      })
      .catch((error) => console.error('Error refreshing place:', error));
    return () => {
      cancelled = true;
    };
  }, [initialPlace.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const address = formatAddress(place);
  const crowd = vibe ? crowdConfig[vibe.crowd_level] : null;

  const features = [
    place.wifi_speed && { icon: WifiHigh, label: `Wi-Fi ${place.wifi_speed}` },
    place.has_plugs && { icon: Plugs, label: 'Prises dispo' },
    place.noise_level && { icon: SpeakerHigh, label: place.noise_level },
    place.laptop_policy && { icon: Laptop, label: place.laptop_policy },
    place.has_terrace && { icon: SunDim, label: 'Terrasse' },
    place.is_vegan && { icon: Leaf, label: 'Vegan' },
  ].filter(Boolean) as { icon: typeof WifiHigh; label: string }[];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-brand-espresso/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Bottom sheet panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={place.name}
        className={`relative w-full max-w-md bg-brand-oat rounded-t-3xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out max-h-[90dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Cover image */}
        <div className="relative h-52 flex-shrink-0 bg-gradient-to-br from-brand-espresso to-brand-mocha">
          {place.image_url ? (
            <img
              src={place.image_url}
              alt={place.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Coffee size={40} weight="duotone" className="text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-oat via-transparent to-black/20" />

          {/* Drag handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/70" />

          <div className="absolute top-4 right-4 flex gap-2">
            <FavoriteButton
              placeId={place.id}
              isSaved={isSaved}
              onToggle={onToggleSave}
              size={18}
              className="w-9 h-9 shadow-md"
            />
            <button
              onClick={handleClose}
              aria-label="Fermer"
              className="w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white active:scale-95 transition-all"
            >
              <X size={18} weight="bold" className="text-brand-espresso" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 -mt-6 relative">
          <h2 className="text-2xl font-extrabold text-brand-espresso tracking-tight mb-1">
            {place.name}
          </h2>

          {address && (
            <p className="flex items-start gap-1.5 text-sm text-brand-mocha mb-4">
              <MapPin size={16} weight="fill" className="text-brand-terracotta flex-shrink-0 mt-0.5" />
              {address}
            </p>
          )}

          {/* Live community vibe */}
          {crowd && vibe && (
            <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-4 ${crowd.classes}`}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                </span>
                <span className="text-sm font-bold">
                  {crowd.emoji} {crowd.label} en ce moment
                </span>
              </div>
              <span className="text-[11px] font-medium opacity-80">
                Wi-Fi {vibe.wifi_speed === 'good' ? '🚀' : '🐌'} · {timeAgo(vibe.created_at)}
              </span>
            </div>
          )}

          {/* Feature pills */}
          {features.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {features.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white text-brand-espresso rounded-full border border-brand-mocha/10 shadow-sm"
                >
                  <Icon size={14} weight="duotone" className="text-brand-mocha" />
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Rich description */}
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-mocha mb-2">
            L&apos;histoire du spot
          </h3>
          {place.description ? (
            <p className="text-sm text-brand-espresso/90 leading-relaxed whitespace-pre-line">
              {place.description}
            </p>
          ) : (
            <p className="text-sm text-brand-mocha/70 italic">
              L&apos;équipe prépare la présentation de ce café. Reviens bientôt !
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 pt-3 border-t border-brand-mocha/10 bg-white flex-shrink-0 flex gap-2">
          <button
            onClick={() => openDirections(place)}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-espresso text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-brand-espresso/90 active:scale-[0.98] transition-all"
          >
            <NavigationArrow size={20} weight="fill" />
            S&apos;y rendre
          </button>
          <button
            onClick={() => setShowCheckIn(true)}
            className="flex items-center justify-center gap-2 bg-brand-matcha/10 text-brand-matcha font-bold px-5 py-4 rounded-2xl hover:bg-brand-matcha/20 active:scale-[0.98] transition-all"
          >
            <Lightning size={20} weight="fill" />
            Checker
          </button>
        </div>
      </div>

      {showCheckIn && (
        <CheckInModal
          place={{ id: place.id, name: place.name, image_url: place.image_url }}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowCheckIn(false)}
          onSubmitted={onCheckedIn}
        />
      )}
    </div>
  );
}
