'use client';

import { Coffee } from '@phosphor-icons/react';
import type { Place } from '@/lib/api/places';
import type { EndorsementCategory } from '@/lib/api/endorsements';

export type PepiteCard = {
  category: EndorsementCategory;
  title: string;
  emoji: string;
  place: Pick<Place, 'id' | 'name' | 'image_url'>;
};

const RANKING_META: {
  category: EndorsementCategory;
  title: string;
  emoji: string;
}[] = [
  { category: 'wifi', title: 'Le Meilleur Wi-Fi', emoji: '💻' },
  { category: 'comfort', title: 'Le Plus Confortable', emoji: '🛋️' },
  { category: 'coffee', title: 'Le Meilleur Café', emoji: '☕' },
  { category: 'food', title: 'La Pépite Food', emoji: '🥐' },
];

/** Build 4 pepite cards from loaded places (mock #1 per category for layout). */
export function buildMockPepites(places: Place[]): PepiteCard[] {
  const pool = places.length > 0 ? places : [];
  return RANKING_META.map((meta, i) => {
    const place =
      pool[i % Math.max(pool.length, 1)] ??
      ({
        id: `mock-${meta.category}`,
        name: 'Café à découvrir',
        image_url: undefined,
      } as Place);
    return {
      ...meta,
      place: {
        id: place.id,
        name: place.name,
        image_url: place.image_url,
      },
    };
  });
}

export default function PepitesCommunSection({
  pepites,
  onOpenPlace,
}: {
  pepites: PepiteCard[];
  onOpenPlace?: (placeId: string) => void;
}) {
  if (pepites.length === 0) return null;

  return (
    <div className="mt-6 mb-2">
      <div className="px-5 mb-3">
        <h3 className="text-lg font-bold text-brand-espresso tracking-tight">
          🏆 Les Pépites de la Commu
        </h3>
        <p className="text-xs text-brand-mocha mt-0.5">
          Les spots plébiscités par les check-ins récents
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-pl-5 snap-x snap-mandatory pb-2">
        <div className="w-5 shrink-0" aria-hidden />
        {pepites.map((card) => (
          <button
            key={card.category}
            type="button"
            onClick={() => onOpenPlace?.(card.place.id)}
            className="relative w-[168px] flex-shrink-0 snap-start rounded-2xl overflow-hidden border border-amber-400/30 bg-brand-surface shadow-md text-left active:scale-[0.97] transition-transform"
          >
            <div className="relative h-24 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
              {card.place.image_url ? (
                <img
                  src={card.place.image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Coffee size={28} weight="duotone" className="text-white/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <span className="absolute top-2 left-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-200 text-amber-950 shadow">
                N°1
              </span>
            </div>
            <div className="p-3">
              <p className="text-[11px] font-bold text-amber-800/90 mb-0.5">
                {card.emoji} {card.title}
              </p>
              <p className="text-sm font-extrabold text-brand-espresso truncate">
                {card.place.name}
              </p>
            </div>
          </button>
        ))}
        <div className="w-4 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
