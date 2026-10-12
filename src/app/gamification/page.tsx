'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from '@phosphor-icons/react';
import CoffeeJar from '@/components/gamification/CoffeeJar';
import {
  currentBadge,
  getGrainsBalance,
  GRAIN_BADGES,
  JAR_CAPACITY,
  jarGrainsFromTotal,
} from '@/lib/grains';

export default function GamificationPage() {
  const [totalGrains, setTotalGrains] = useState(0);

  useEffect(() => {
    setTotalGrains(getGrainsBalance());
  }, []);

  const levelBadge = useMemo(() => currentBadge(totalGrains), [totalGrains]);
  const jarFill = jarGrainsFromTotal(totalGrains);
  const toNext = JAR_CAPACITY - jarFill;

  return (
    <div className="flex-1 min-h-full bg-brand-oat pb-24">
      <div className="sticky top-0 z-30 bg-brand-oat/90 backdrop-blur-md border-b border-brand-mocha/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/check-in"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-surface border border-brand-mocha/10 text-brand-espresso hover:bg-brand-muted active:scale-95 transition-all"
          >
            <ArrowLeft size={20} weight="bold" />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-brand-espresso tracking-tight">
              Mes Grains
            </h1>
            <p className="text-xs text-brand-mocha">
              Collectionne et débloque des badges
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-8 flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-mocha mb-1">
          Niveau
        </p>
        <p className="text-2xl font-extrabold text-brand-espresso tracking-tight mb-8">
          {levelBadge.icon} {levelBadge.name}
        </p>

        {/* Scène immersive autour du bocal */}
        <div className="relative mb-6 w-full max-w-sm">
          <div
            className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-amber-900/90 via-[#3d2a1c] to-brand-ink blur-[1px]"
            aria-hidden
          />
          <div className="relative rounded-[2.5rem] bg-gradient-to-br from-[#4a3428]/95 via-brand-ink to-[#1a100c] p-10 shadow-2xl overflow-hidden">
            {/* Reflets ambiants */}
            <div
              className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl animate-pulse-glow"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-amber-600/15 blur-2xl"
              aria-hidden
            />
            <CoffeeJar totalGrains={totalGrains} size="lg" />
          </div>
        </div>

        <p className="text-sm font-bold text-brand-espresso tabular-nums">
          {totalGrains} Grains au total
        </p>
        <p className="mt-1 text-sm text-brand-mocha max-w-[280px] leading-relaxed">
          Encore {toNext} grain{toNext > 1 ? 's' : ''} pour remplir le bocal.
          Remplis-le pour débloquer des récompenses exclusives dans tes cafés
          favoris !
        </p>

        <section className="w-full mt-10 text-left">
          <h2 className="text-lg font-extrabold text-brand-espresso tracking-tight mb-4">
            Mes Badges
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {GRAIN_BADGES.map((badge) => {
              const unlocked = totalGrains >= badge.threshold;
              return (
                <div
                  key={badge.name}
                  className={`relative rounded-2xl border p-4 flex flex-col items-center text-center transition-all ${
                    unlocked
                      ? 'bg-brand-surface border-amber-300/40 shadow-md shadow-amber-500/10'
                      : 'bg-brand-muted/50 border-brand-mocha/10 opacity-50'
                  }`}
                >
                  {!unlocked && (
                    <span className="absolute top-2.5 right-2.5 text-xs" aria-hidden>
                      🔒
                    </span>
                  )}
                  <span
                    className={`text-4xl leading-none mb-2 ${unlocked ? '' : 'grayscale'}`}
                  >
                    {badge.icon}
                  </span>
                  <p
                    className={`text-sm font-extrabold ${
                      unlocked ? 'text-brand-espresso' : 'text-brand-mocha'
                    }`}
                  >
                    {badge.name}
                  </p>
                  <p className="text-[11px] text-brand-mocha mt-0.5 flex items-center gap-1">
                    {!unlocked && <Lock size={10} weight="fill" />}
                    {badge.threshold === 0
                      ? 'Débloqué'
                      : `${badge.threshold} Grains`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
