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
  QrCode,
} from '@phosphor-icons/react';
import { Drop, isDropLive, formatDateTime, type DropTypeId } from '@/lib/api/drops';
import { normalizeDropType } from '@/lib/filters';
import Button from '@/components/ui/Button';

interface DropDetailModalProps {
  drop: Drop;
  countdown: string;
  isAuthenticated: boolean;
  /** Legacy drops only — local « inscrit » state. */
  isClaimed: boolean;
  claimBusy?: boolean;
  claimError?: string | null;
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
  claimBusy = false,
  claimError = null,
  onClaim,
  onClose,
}: DropDetailModalProps) {
  const [visible, setVisible] = useState(false);
  const typeConfig = getDropTypeConfig(drop.drop_type);
  const TypeIcon = typeConfig.icon;
  const live = isDropLive(drop);
  const isFlash = drop.source === 'flash_drops';

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
        className={`relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-ds-bg shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="relative h-40 flex-shrink-0 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
          {drop.places?.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={drop.places.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ds-bg via-transparent to-transparent" />

          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 rounded-full bg-ds-surface/90 p-2 shadow-md backdrop-blur-sm transition-all hover:bg-ds-surface active:scale-95"
          >
            <X size={20} weight="bold" className="text-ds-text" />
          </button>

          <div
            className={`absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-ds-surface/90 px-3 py-1.5 text-xs font-bold backdrop-blur-sm ${typeConfig.classes}`}
          >
            <TypeIcon size={14} weight="fill" />
            {typeConfig.label}
          </div>
        </div>

        <div className="relative -mt-4 flex-1 overflow-y-auto p-5 pb-6">
          <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-ds-text">
            {drop.title}
          </h2>

          <p className="mb-4 flex items-center gap-1.5 text-sm text-ds-text2">
            <MapPin size={16} weight="fill" className="flex-shrink-0 text-ds-accent" />
            {drop.places?.name || 'Lieu à déterminer'}
          </p>

          <div className="mb-4 divide-y divide-ds-text2/5 rounded-2xl border border-ds-text2/10 bg-ds-surface shadow-sm">
            <div className="flex items-center gap-3 p-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ds-ok/10">
                <CalendarBlank size={18} weight="duotone" className="text-ds-ok" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-ds-text2">Début</p>
                <p className="text-sm font-semibold text-ds-text">
                  {formatDateTime(drop.start_time)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ds-accent/10">
                <Timer size={18} weight="duotone" className="text-ds-accent" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-medium text-ds-text2">
                  {live ? 'Se termine dans' : 'Fin'}
                </p>
                <p className="text-sm font-semibold text-ds-text">
                  {live ? countdown : formatDateTime(drop.end_time)}
                </p>
              </div>
              {live && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ds-accent opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ds-accent" />
                </span>
              )}
            </div>
          </div>

          {drop.description && (
            <p className="mb-4 text-sm leading-relaxed text-ds-text2">
              {drop.description}
            </p>
          )}

          {drop.capacity ? (
            <div className="mb-4 flex items-center gap-2 text-sm text-ds-text2">
              <Users size={16} weight="duotone" />
              <span>
                {drop.current_participants ?? 0} / {drop.capacity} participants
              </span>
            </div>
          ) : null}

          {claimError ? (
            <p
              role="alert"
              className="mb-3 rounded-xl bg-ds-dangersoft px-3.5 py-2.5 text-sm font-semibold text-ds-danger"
            >
              {claimError}
            </p>
          ) : null}
        </div>

        <div className="flex-shrink-0 border-t border-ds-text2/10 bg-ds-surface p-5 pt-3">
          {isFlash ? (
            <Button
              variant="main"
              className="h-14 w-full"
              disabled={claimBusy}
              onClick={onClaim}
            >
              <QrCode size={20} weight="regular" aria-hidden />
              {claimBusy ? 'Code en cours…' : 'Obtenir mon code'}
            </Button>
          ) : isClaimed ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ds-ok/10 py-4 font-bold text-ds-ok">
              <CheckCircle size={22} weight="fill" />
              Inscrit — on t&apos;attend ! ✅
            </div>
          ) : isAuthenticated ? (
            <button
              type="button"
              onClick={onClaim}
              className="w-full rounded-2xl bg-ds-ok py-4 font-bold text-white shadow-lg shadow-ds-ok/25 transition-all hover:bg-ds-ok/90 active:scale-[0.98]"
            >
              {drop.drop_type === 'promo'
                ? 'Réclamer ce drop'
                : drop.drop_type === 'event'
                  ? "Rejoindre l'événement"
                  : 'Participer'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClaim}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ds-pin py-4 font-bold text-white shadow-lg transition-all hover:bg-ds-pin/90 active:scale-[0.98]"
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
