'use client';

import { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  CalendarBlank,
  Timer,
  Sneaker,
  Tag,
  Confetti,
  CheckCircle,
  LockKey,
  Users,
} from '@phosphor-icons/react';
import { Drop, isDropLive, formatDateTime } from '@/lib/api/drops';

interface DropDetailModalProps {
  drop: Drop;
  countdown: string;
  isAuthenticated: boolean;
  isClaimed: boolean;
  onClaim: () => void;
  onClose: () => void;
}

export const dropTypeConfig: Record<
  Drop['drop_type'],
  { label: string; icon: typeof Sneaker; classes: string }
> = {
  sport: {
    label: 'Sport',
    icon: Sneaker,
    classes: 'bg-brand-terracotta/10 text-brand-terracotta',
  },
  promo: {
    label: 'Promo',
    icon: Tag,
    classes: 'bg-brand-matcha/10 text-brand-matcha',
  },
  event: {
    label: 'Événement',
    icon: Confetti,
    classes: 'bg-brand-mocha/10 text-brand-mocha',
  },
};

export default function DropDetailModal({
  drop,
  countdown,
  isAuthenticated,
  isClaimed,
  onClaim,
  onClose,
}: DropDetailModalProps) {
  const [visible, setVisible] = useState(false);
  const typeConfig = dropTypeConfig[drop.drop_type];
  const TypeIcon = typeConfig.icon;
  const live = isDropLive(drop);

  // Slide-in on mount, and lock body scroll while open
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    // Let the slide-out animation finish before unmounting
    setTimeout(onClose, 250);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Bottom sheet panel */}
      <div
        className={`relative w-full max-w-md bg-brand-oat rounded-t-3xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out max-h-[85dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header image */}
        <div className="relative h-40 flex-shrink-0 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
          {drop.places?.image_url && (
            <img
              src={drop.places.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-oat via-transparent to-transparent" />

          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 bg-brand-surface/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-brand-surface active:scale-95 transition-all"
          >
            <X size={20} weight="bold" className="text-brand-espresso" />
          </button>

          {/* Type badge */}
          <div
            className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-surface/90 backdrop-blur-sm ${typeConfig.classes}`}
          >
            <TypeIcon size={14} weight="fill" />
            {typeConfig.label}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 pb-6 -mt-4 relative">
          <h2 className="text-2xl font-extrabold text-brand-espresso tracking-tight mb-1">
            {drop.title}
          </h2>

          <p className="flex items-center gap-1.5 text-sm text-brand-mocha mb-4">
            <MapPin size={16} weight="fill" className="text-brand-terracotta flex-shrink-0" />
            {drop.places?.name || 'Lieu à déterminer'}
          </p>

          {/* Time info */}
          <div className="bg-brand-surface rounded-2xl border border-brand-mocha/10 shadow-sm divide-y divide-brand-mocha/5 mb-4">
            <div className="flex items-center gap-3 p-3.5">
              <div className="w-9 h-9 rounded-xl bg-brand-matcha/10 flex items-center justify-center flex-shrink-0">
                <CalendarBlank size={18} weight="duotone" className="text-brand-matcha" />
              </div>
              <div>
                <p className="text-[11px] text-brand-mocha font-medium">Début</p>
                <p className="text-sm font-semibold text-brand-espresso">
                  {formatDateTime(drop.start_time)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3.5">
              <div className="w-9 h-9 rounded-xl bg-brand-terracotta/10 flex items-center justify-center flex-shrink-0">
                <Timer size={18} weight="duotone" className="text-brand-terracotta" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-brand-mocha font-medium">
                  {live ? 'Se termine dans' : 'Fin'}
                </p>
                <p className="text-sm font-semibold text-brand-espresso">
                  {live ? countdown : formatDateTime(drop.end_time)}
                </p>
              </div>
              {live && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-terracotta opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-terracotta" />
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {drop.description && (
            <p className="text-sm text-brand-mocha leading-relaxed mb-4">
              {drop.description}
            </p>
          )}

          {/* Capacity */}
          {drop.capacity && (
            <div className="flex items-center gap-2 text-sm text-brand-mocha mb-4">
              <Users size={16} weight="duotone" />
              <span>
                {drop.current_participants ?? 0} / {drop.capacity} participants
              </span>
            </div>
          )}
        </div>

        {/* Claim action */}
        <div className="p-5 pt-3 border-t border-brand-mocha/10 bg-brand-surface flex-shrink-0">
          {isClaimed ? (
            <div className="w-full flex items-center justify-center gap-2 bg-brand-matcha/10 text-brand-matcha font-bold py-4 rounded-2xl">
              <CheckCircle size={22} weight="fill" />
              Inscrit — on t'attend ! ✅
            </div>
          ) : isAuthenticated ? (
            <button
              onClick={onClaim}
              className="w-full bg-brand-matcha text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-matcha/25 hover:bg-brand-matcha/90 active:scale-[0.98] transition-all"
            >
              {drop.drop_type === 'promo'
                ? 'Réclamer ce drop'
                : drop.drop_type === 'event'
                  ? 'Rejoindre l’événement'
                  : 'Participer'}
            </button>
          ) : (
            <button
              onClick={onClaim}
              className="w-full flex items-center justify-center gap-2 bg-brand-ink text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-brand-ink/90 active:scale-[0.98] transition-all"
            >
              <LockKey size={18} weight="fill" />
              Connecte-toi pour participer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
