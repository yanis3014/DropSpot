'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkle, Gift } from '@phosphor-icons/react';
import CoffeeJar from '@/components/gamification/CoffeeJar';
import { getGrainsBalance } from '@/lib/grains';

export default function GamificationPage() {
  const [grains, setGrains] = useState(0);

  useEffect(() => {
    setGrains(getGrainsBalance());
  }, []);

  return (
    <div className="flex-1 min-h-full bg-brand-oat">
      {/* Header */}
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
            <p className="text-xs text-brand-mocha">Collectionne et débloque des récompenses</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-8 flex flex-col items-center text-center">
        <div className="relative mb-6">
          <span className="absolute inset-0 rounded-full bg-brand-matcha/10 animate-pulse" />
          <CoffeeJar currentGrains={grains} maxGrains={100} size="lg" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-brand-matcha/10 px-4 py-2 mb-4">
          <Sparkle size={16} weight="fill" className="text-brand-matcha" />
          <span className="text-sm font-extrabold text-brand-matcha">
            {grains} Grains accumulés
          </span>
        </div>

        <h2 className="text-2xl font-extrabold text-brand-espresso tracking-tight mb-3">
          Remplis ton bocal
        </h2>
        <p className="text-base text-brand-mocha max-w-[280px] leading-relaxed">
          Remplis ton bocal pour débloquer des récompenses exclusives dans tes
          cafés favoris !
        </p>

        <div className="w-full mt-10 space-y-3">
          <div className="flex items-center gap-4 rounded-2xl bg-brand-surface border border-brand-mocha/8 p-4 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-brand-terracotta/10 flex items-center justify-center flex-shrink-0">
              <Gift size={22} weight="duotone" className="text-brand-terracotta" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-brand-espresso">Boisson offerte</p>
              <p className="text-xs text-brand-mocha">Atteins 100 Grains pour un café offert</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-brand-surface border border-brand-mocha/8 p-4 shadow-sm opacity-60">
            <div className="w-11 h-11 rounded-xl bg-brand-matcha/10 flex items-center justify-center flex-shrink-0">
              <Sparkle size={22} weight="duotone" className="text-brand-matcha" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-brand-espresso">Badge Barista</p>
              <p className="text-xs text-brand-mocha">Prochain palier : 250 Grains</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
