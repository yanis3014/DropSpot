'use client';

import {
  MapPin,
  Coffee,
  Sparkle,
  CaretRight,
  CheckCircle,
} from '@phosphor-icons/react';
import {
  Drop,
  isDropLive,
  formatTime,
  formatCountdown,
  getDropTiming,
} from '@/lib/api/drops';
import { getDropTypeConfig } from '@/components/drops/DropDetailModal';
import { preferenceById, PreferenceId } from '@/lib/preferences';

export function ForYouBadge({ matches }: { matches: PreferenceId[] }) {
  if (matches.length === 0) return null;
  const emojis = matches.slice(0, 2).map((m) => preferenceById[m].emoji).join('');
  return (
    <span
      title={matches.map((m) => preferenceById[m].label).join(' · ')}
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-matcha text-white shadow-sm shadow-brand-matcha/30"
    >
      <Sparkle size={10} weight="fill" />
      Pour toi {emojis}
    </span>
  );
}

interface DropCardProps {
  drop: Drop;
  isClaimed: boolean;
  now: number;
  matches?: PreferenceId[];
  onOpen: () => void;
  /** Compact carousel card (feed) vs full-width list row (drops page). */
  variant?: 'carousel' | 'list';
}

function timingLabel(drop: Drop, now: number): { text: string; classes: string } {
  const timing = getDropTiming(drop, now);
  if (timing === 'live') {
    return {
      text: drop.drop_type === 'promo' ? formatCountdown(drop.end_time, now) : 'En cours',
      classes: 'bg-brand-matcha/12 text-brand-matcha',
    };
  }
  if (timing === 'upcoming') {
    return {
      text: formatTime(drop.start_time),
      classes: 'bg-brand-muted text-brand-mocha',
    };
  }
  return {
    text: 'Terminé',
    classes: 'bg-brand-muted/80 text-brand-mocha/70',
  };
}

export default function DropCard({
  drop,
  isClaimed,
  now,
  matches = [],
  onOpen,
  variant = 'carousel',
}: DropCardProps) {
  const typeConfig = getDropTypeConfig(drop.drop_type);
  const TypeIcon = typeConfig.icon;
  const iconColor = typeConfig.classes.split(' ').find((c) => c.startsWith('text-'));
  const live = isDropLive(drop);
  const timeBadge =
    drop.drop_type === 'promo'
      ? formatCountdown(drop.end_time, now)
      : formatTime(drop.start_time);
  const placeLabel =
    drop.places?.name ||
    [drop.places?.city, drop.places?.address].filter(Boolean).join(' · ') ||
    'Lieu à déterminer';
  const cta =
    drop.drop_type === 'promo'
      ? 'Réclamer'
      : drop.drop_type === 'event'
        ? 'Rejoindre'
        : 'Participer';
  const status = timingLabel(drop, now);

  if (variant === 'list') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`group w-full text-left bg-brand-surface rounded-3xl overflow-hidden border transition-all active:scale-[0.99] hover:shadow-md ${
          matches.length > 0
            ? 'border-brand-matcha/35 ring-1 ring-brand-matcha/15'
            : 'border-brand-mocha/8'
        }`}
      >
        <div className="flex gap-0">
          {/* Large thumbnail */}
          <div className="relative w-[112px] self-stretch flex-shrink-0 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
            {drop.places?.image_url ? (
              <img
                src={drop.places.image_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Coffee size={32} weight="duotone" className="text-white/35" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeConfig.classes}`}
              >
                <TypeIcon size={11} weight="fill" />
                {typeConfig.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${status.classes}`}
              >
                {live && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-matcha opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-matcha" />
                  </span>
                )}
                {status.text}
              </span>
              <ForYouBadge matches={matches} />
            </div>

            <h3 className="text-[15px] font-bold text-brand-espresso tracking-tight leading-snug line-clamp-2">
              {drop.title}
            </h3>

            <p className="flex items-center gap-1 text-xs text-brand-mocha truncate">
              <MapPin size={12} weight="fill" className="flex-shrink-0 text-brand-terracotta/80" />
              <span className="truncate">{placeLabel}</span>
            </p>

            <div className="mt-auto pt-2 flex items-center justify-between gap-2">
              {isClaimed ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-matcha">
                  <CheckCircle size={14} weight="fill" />
                  Inscrit
                </span>
              ) : (
                <span className="inline-flex items-center justify-center text-xs font-bold text-white bg-brand-matcha px-3.5 py-1.5 rounded-full shadow-sm shadow-brand-matcha/20">
                  {cta}
                </span>
              )}
              <CaretRight
                size={16}
                weight="bold"
                className="text-brand-mocha/40 group-hover:text-brand-mocha group-hover:translate-x-0.5 transition-all"
              />
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={`relative w-[240px] flex-shrink-0 snap-start bg-brand-surface rounded-2xl overflow-hidden shadow-sm border cursor-pointer active:scale-[0.97] transition-transform ${
        matches.length > 0
          ? 'border-brand-matcha/40 ring-1 ring-brand-matcha/20'
          : 'border-brand-mocha/5'
      }`}
    >
      <div className="relative h-24 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
        {drop.places?.image_url ? (
          <img
            src={drop.places.image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Coffee size={28} weight="duotone" className="text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <span className="absolute top-2 left-2 flex items-center gap-1 bg-brand-surface/95 backdrop-blur-sm rounded-full px-2 py-0.5 shadow">
          {live && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-terracotta opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-terracotta" />
            </span>
          )}
          <TypeIcon size={10} weight="fill" className={iconColor} />
          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-espresso">
            {typeConfig.label}
          </span>
        </span>

        <span className="absolute top-2 right-2 bg-brand-terracotta text-white text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums shadow">
          {timeBadge}
        </span>

        {matches.length > 0 && (
          <span className="absolute bottom-2 left-2">
            <ForYouBadge matches={matches} />
          </span>
        )}
      </div>

      <div className="p-3">
        <h4 className="text-sm font-bold text-brand-espresso truncate mb-1.5">
          {drop.title}
        </h4>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[11px] text-brand-mocha min-w-0">
            <MapPin size={11} weight="fill" className="flex-shrink-0" />
            <span className="truncate">{placeLabel}</span>
          </p>

          {isClaimed ? (
            <span className="flex-shrink-0 bg-brand-matcha/10 text-brand-matcha text-[10px] font-bold px-2.5 py-1 rounded-full">
              Inscrit
            </span>
          ) : (
            <span className="flex-shrink-0 bg-brand-matcha text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm shadow-brand-matcha/30 pointer-events-none">
              {cta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
