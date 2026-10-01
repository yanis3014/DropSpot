'use client';

import { useEffect, useState } from 'react';
import { JAR_CAPACITY, jarGrainsFromTotal } from '@/lib/grains';

interface CoffeeJarProps {
  /** Lifetime grains score — fill uses total % 100. */
  totalGrains: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function CoffeeJar({ totalGrains, size = 'md' }: CoffeeJarProps) {
  const [mounted, setMounted] = useState(false);
  const jarGrains = jarGrainsFromTotal(totalGrains);
  const pct = (jarGrains / JAR_CAPACITY) * 100;

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
    sm: 'w-20 h-24',
    md: 'w-28 h-36',
    lg: 'w-36 h-44',
  }[size];

  return (
    <div
      className={`${dims} relative mx-auto overflow-hidden rounded-t-lg rounded-b-3xl border-2 border-white/25 bg-white/10 shadow-xl backdrop-blur-md`}
      style={{
        boxShadow:
          'inset 0 0 24px rgba(255,255,255,0.15), 0 12px 32px rgba(0,0,0,0.12)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-20 rounded-b-3xl rounded-t-lg bg-gradient-to-br from-white/20 via-transparent to-white/5" />
      <div className="pointer-events-none absolute left-2 top-2 bottom-2 z-20 w-2 rounded-full bg-gradient-to-b from-white/25 to-transparent" />

      <div
        className="absolute bottom-0 left-0 right-0 z-10 transition-[height] duration-1000 ease-out bg-gradient-to-t from-[#6f4e37] via-[#9c6f44] to-[#c99756]"
        style={{ height: mounted ? `${pct}%` : '0%' }}
      >
        <div className="absolute left-0 right-0 top-0 h-2 -translate-y-1/2 rounded-full bg-[#d4a768]/60 blur-[2px]" />
        <span className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
        <span
          className="absolute bottom-6 right-4 w-1 h-1 rounded-full bg-white/30 animate-pulse"
          style={{ animationDelay: '0.5s' }}
        />
      </div>

      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-1">
        <span className="text-lg font-extrabold text-white drop-shadow-md tabular-nums leading-tight">
          {jarGrains} / {JAR_CAPACITY}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white/90 drop-shadow">
          Grains
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-2 rounded-t-lg bg-white/15" />
    </div>
  );
}
