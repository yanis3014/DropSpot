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
  Sparkle,
  CheckCircle,
  LockKey,
  Users,
} from '@phosphor-icons/react';
import { Drop, isDropLive, formatDateTime, type DropTypeId } from '@/lib/api/drops';
import { normalizeDropType } from '@/lib/filters';

interface DropDetailModalProps {
  drop: Drop;
  countdown: string;
  isAuthenticated: boolean;
  isClaimed: boolean;
  onClaim: () => void;
  onClose: () => void;
}

export type DropTypeConfig = {
  label: string;
  icon: typeof Sneaker;
  classes: string;
};

export const dropTypeConfig: Record<DropTypeId, DropTypeConfig> = {
  sport: {
    label: 'Sport',
    icon: Sneaker,
    classes: 'bg-ds-accent/10 text-ds-accent',
  },
  promo: {
    label: 'Promo',
    icon: Tag,
    classes: 'bg-ds-ok/10 text-ds-ok',
  },
  event: {
    label: 'Événement',
    icon: Confetti,
    classes: 'bg-ds-text2/10 text-ds-text2',
  },
};

/** Safe lookup — unknown DB values won't crash the UI. */
export const defaultDropTypeConfig: DropTypeConfig = {
  label: 'Drop',
  icon: Sparkle,
  classes: 'bg-ds-text2/10 text-ds-text2',
};

export function getDropTypeConfig(dropType: string | null | undefined): DropTypeConfig {
  const normalized = normalizeDropType(dropType);
  if (normalized) return dropTypeConfig[normalized];
  return defaultDropTypeConfig;
}

export default function DropDetailModal({
  drop,
  countdown,
  isAuthenticated,
  isClaimed,
  onClaim,
  onClose,
}: DropDetailModalProps) {
  const [visible, setVisible] = useState(false);
  const typeConfig = getDropTypeConfig(drop.drop_type);
  const TypeIcon = typeConfig.icon;
  const live = isDropLive(drop);

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
    setTimeout(onClose, 250);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`relative w-full max-w-md bg-ds-bg rounded-t-3xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out max-h-[85dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="relative h-40 flex-shrink-0 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
          {drop.places?.image_url && (
            <img
              src={drop.places.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ds-bg via-transparent to-transparent" />

          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 bg-ds-surface/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-ds-surface active:scale-95 transition-all"
          >
            <X size={20} weight="bold" className="text-ds-text" />
          </button>

          <div
            className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-ds-surface/90 backdrop-blur-sm ${typeConfig.classes}`}
          >
            <TypeIcon size={14} weight="fill" />
            {typeConfig.label}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-6 -mt-4 relative">
          <h2 className="text-2xl font-extrabold text-ds-text tracking-tight mb-1">
            {drop.title}
          </h2>

          <p className="flex items-center gap-1.5 text-sm text-ds-text2 mb-4">
            <MapPin size={16} weight="fill" className="text-ds-accent flex-shrink-0" />
            {drop.places?.name || 'Lieu à déterminer'}
          </p>

          <div className="bg-ds-surface rounded-2xl border border-ds-text2/10 shadow-sm divide-y divide-ds-text2/5 mb-4">
            <div className="flex items-center gap-3 p-3.5">
              <div className="w-9 h-9 rounded-xl bg-ds-ok/10 flex items-center justify-center flex-shrink-0">
                <CalendarBlank size={18} weight="duotone" className="text-ds-ok" />
              </div>
              <div>
                <p className="text-[11px] text-ds-text2 font-medium">Début</p>
                <p className="text-sm font-semibold text-ds-text">
                  {formatDateTime(drop.start_time)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3.5">
              <div className="w-9 h-9 rounded-xl bg-ds-accent/10 flex items-center justify-center flex-shrink-0">
                <Timer size={18} weight="duotone" className="text-ds-accent" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-ds-text2 font-medium">
                  {live ? 'Se termine dans' : 'Fin'}
                </p>
                <p className="text-sm font-semibold text-ds-text">
                  {live ? countdown : formatDateTime(drop.end_time)}
                </p>
              </div>
              {live && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ds-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ds-accent" />
                </span>
              )}
            </div>
          </div>

          {drop.description && (
            <p className="text-sm text-ds-text2 leading-relaxed mb-4">
              {drop.description}
            </p>
          )}

          {drop.capacity && (
            <div className="flex items-center gap-2 text-sm text-ds-text2 mb-4">
              <Users size={16} weight="duotone" />
              <span>
                {drop.current_participants ?? 0} / {drop.capacity} participants
              </span>
            </div>
          )}
        </div>

        <div className="p-5 pt-3 border-t border-ds-text2/10 bg-ds-surface flex-shrink-0">
          {isClaimed ? (
            <div className="w-full flex items-center justify-center gap-2 bg-ds-ok/10 text-ds-ok font-bold py-4 rounded-2xl">
              <CheckCircle size={22} weight="fill" />
              Inscrit — on t&apos;attend ! ✅
            </div>
          ) : isAuthenticated ? (
            <button
              onClick={onClaim}
              className="w-full bg-ds-ok text-white font-bold py-4 rounded-2xl shadow-lg shadow-ds-ok/25 hover:bg-ds-ok/90 active:scale-[0.98] transition-all"
            >
              {drop.drop_type === 'promo'
                ? 'Réclamer ce drop'
                : drop.drop_type === 'event'
                  ? "Rejoindre l'événement"
                  : 'Participer'}
            </button>
          ) : (
            <button
              onClick={onClaim}
              className="w-full flex items-center justify-center gap-2 bg-ds-pin text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-ds-pin/90 active:scale-[0.98] transition-all"
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
