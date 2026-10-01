'use client';

import type { EndorsementCategory, PlaceTrophy } from '@/lib/api/endorsements';
import { endorsementCategories } from '@/lib/api/endorsements';

const MOCK_LABELS: { category: EndorsementCategory; badgeText: string }[] = [
  { category: 'wifi', badgeText: '🏆 N°1 Wi-Fi' },
  { category: 'coffee', badgeText: '🏆 N°1 Café' },
  { category: 'comfort', badgeText: '🏆 Top Confort' },
  { category: 'food', badgeText: '🏆 Pépite Food' },
];

/** Deterministic mock trophy from place id (for design when rankings are empty). */
export function mockTrophyForPlace(placeId: string): PlaceTrophy {
  let hash = 0;
  for (let i = 0; i < placeId.length; i++) {
    hash = (hash + placeId.charCodeAt(i) * (i + 1)) % 997;
  }
  const pick = MOCK_LABELS[hash % MOCK_LABELS.length];
  return { category: pick.category, count: 8 + (hash % 12), badgeText: pick.badgeText };
}

export default function TrophyBadge({
  label,
  trophy,
  size = 'md',
  className = '',
}: {
  /** Free-form label (e.g. "🏆 N°1 Wi-Fi"). Overrides trophy.badgeText if set. */
  label?: string;
  trophy?: PlaceTrophy | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const text =
    label ??
    trophy?.badgeText ??
    (trophy
      ? `🏆 N°1 ${endorsementCategories.find((c) => c.id === trophy.category)?.trophyLabel ?? ''}`
      : null);

  if (!text) return null;

  const sizeClasses = {
    sm: 'text-[10px] px-2.5 py-1 gap-1',
    md: 'text-xs px-3 py-1.5 gap-1.5',
    lg: 'text-sm px-3.5 py-2 gap-1.5',
  }[size];

  return (
    <span
      className={[
        'inline-flex items-center font-extrabold tracking-tight rounded-full',
        'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200',
        'text-amber-950 border border-amber-500/40',
        'shadow-[0_4px_14px_rgba(217,119,6,0.35)]',
        sizeClasses,
        className,
      ].join(' ')}
      title={trophy ? `${trophy.count} votes récents` : undefined}
    >
      {text}
    </span>
  );
}
