'use client';

import Link from 'next/link';
import { CaretRight, Parachute } from '@phosphor-icons/react';
import DropCard from '@/components/drops/DropCard';
import SeeMoreDropsCard from '@/components/drops/SeeMoreDropsCard';
import { Drop } from '@/lib/api/drops';

const FEED_DROP_LIMIT = 3;

interface DropSectionProps {
  drops: Drop[];
  dropsLoading: boolean;
  claimedDrops: string[];
  now: number;
  onOpenDrop: (drop: Drop) => void;
}

export default function DropSection({
  drops,
  dropsLoading,
  claimedDrops,
  now,
  onOpenDrop,
}: DropSectionProps) {
  return (
    <section className="mb-10">
      <h2 className="px-5 text-xl font-bold mb-4 text-brand-dark">
        À découvrir en ce moment
      </h2>

      {dropsLoading ? (
        <div className="flex gap-3 px-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[200px] h-[140px] flex-shrink-0 rounded-2xl bg-brand-espresso/[0.04] animate-pulse"
            />
          ))}
        </div>
      ) : drops.length === 0 ? (
        <div className="mx-5 border border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-white/50">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 text-gray-400">
            <Parachute size={24} />
          </div>
          <h3 className="font-semibold text-brand-dark mb-1">
            Aucun drop pour l'instant
          </h3>
          <p className="text-sm text-gray-500">
            Élargis ta recherche ou désactive un filtre.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto scrollbar-hide scroll-pl-5 snap-x snap-mandatory pb-2">
          <div className="w-5 shrink-0" aria-hidden />
          {drops.slice(0, FEED_DROP_LIMIT).map((drop) => (
            <DropCard
              key={drop.id}
              drop={drop}
              isClaimed={claimedDrops.includes(drop.id)}
              now={now}
              variant="carousel"
              onOpen={() => onOpenDrop(drop)}
            />
          ))}
          <SeeMoreDropsCard />
          <div className="w-4 shrink-0" aria-hidden />
        </div>
      )}

      <div className="px-5 mt-4">
        <Link
          href="/drops"
          className="inline-flex items-center gap-1 text-brand-green text-sm font-medium hover:underline"
        >
          Voir tous les drops <CaretRight size={12} weight="bold" />
        </Link>
      </div>
    </section>
  );
}
