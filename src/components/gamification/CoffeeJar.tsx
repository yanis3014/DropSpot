'use client';

import { useEffect, useState } from 'react';
import { JAR_CAPACITY, jarGrainsFromTotal } from '@/lib/grains';

interface CoffeeJarProps {
  /** Lifetime grains score — fill uses total % 100. */
  totalGrains: number;
  size?: 'sm' | 'md' | 'lg';
}

const PARTICLES = [
  { left: '18%', bottom: '22%', delay: '0s', cls: 'animate-float-up' },
  { left: '42%', bottom: '30%', delay: '0.8s', cls: 'animate-float-up-delayed' },
  { left: '68%', bottom: '18%', delay: '1.2s', cls: 'animate-float-up' },
  { left: '30%', bottom: '45%', delay: '0.4s', cls: 'animate-float-up-delayed' },
  { left: '55%', bottom: '38%', delay: '1.6s', cls: 'animate-float-up' },
] as const;

export default function CoffeeJar({ totalGrains, size = 'md' }: CoffeeJarProps) {
  const [mounted, setMounted] = useState(false);
  const jarGrains = jarGrainsFromTotal(totalGrains);
  const pct = Math.min(100, Math.max(0, (jarGrains / JAR_CAPACITY) * 100));

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Re-animate when crossing a level threshold (jar empties / refills).
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, [jarGrains, totalGrains]);

  const dims = {
    sm: 'w-24 h-28',
    md: 'w-32 h-40',
    lg: 'w-40 h-52',
  }[size];

  return (
    <div className={`relative mx-auto ${dims}`}>
      {/* Halo lumineux derrière le bocal */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-full bg-amber-400/25 blur-2xl animate-pulse-glow"
        aria-hidden
      />

      {/* Bocal en verre */}
      <div className="glass-jar relative h-full w-full overflow-hidden rounded-t-2xl rounded-b-[2.5rem]">
        {/* Reflet latéral */}
        <div
          className="pointer-events-none absolute left-2 top-3 bottom-6 z-20 w-2.5 rounded-full bg-gradient-to-b from-white/50 via-white/15 to-transparent"
          aria-hidden
        />
        {/* Reflet haut */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-3 rounded-t-2xl bg-white/25"
          aria-hidden
        />

        {/* Liquide animé (hauteur = remplissage) */}
        <div
          className="liquid-container z-10"
          style={{ height: mounted ? `${Math.max(pct, pct > 0 ? 8 : 0)}%` : '0%' }}
        >
          <div className="liquid-wave animate-wave" aria-hidden />
          <div className="liquid-wave animate-wave-slow" aria-hidden />

          {/* Particules flottantes (visibles dès qu'il y a un peu de liquide) */}
          {pct > 5 &&
            PARTICLES.map((p, i) => (
              <span
                key={i}
                className={`pointer-events-none absolute z-10 h-1.5 w-1.5 rounded-full bg-amber-100/80 shadow-[0_0_6px_rgba(251,191,36,0.8)] ${p.cls}`}
                style={{
                  left: p.left,
                  bottom: p.bottom,
                  animationDelay: p.delay,
                }}
                aria-hidden
              />
            ))}
        </div>

        {/* Compteur au centre */}
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-2">
          <span className="text-xl font-extrabold text-white drop-shadow-md tabular-nums leading-tight">
            {jarGrains}
            <span className="text-white/80 text-base font-bold">
              {' '}
              / {JAR_CAPACITY}
            </span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/90 drop-shadow mt-0.5">
            Grains
          </span>
        </div>
      </div>

      {/* Col / bouchon du bocal */}
      <div
        className="absolute -top-2 left-1/2 z-40 h-3 w-[55%] -translate-x-1/2 rounded-t-lg border border-white/40 bg-white/30 backdrop-blur-sm shadow-sm"
        aria-hidden
      />
    </div>
  );
}
