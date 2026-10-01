'use client';

import { useEffect, useState } from 'react';

interface CoffeeJarProps {
  currentGrains: number;
  maxGrains?: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function CoffeeJar({
  currentGrains,
  maxGrains = 100,
  size = 'md',
}: CoffeeJarProps) {
  const [mounted, setMounted] = useState(false);
  const pct = Math.min(100, Math.max(0, (currentGrains / maxGrains) * 100));

  useEffect(() => {
    // Trigger fill animation after mount so it animates in.
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const dims = {
    sm: 'w-20 h-24',
    md: 'w-28 h-36',
    lg: 'w-36 h-44',
  }[size];

  return (
    <div
      className={`${dims} relative mx-auto overflow-hidden rounded-t-lg rounded-b-3xl border-2 border-white/25 bg-white/10 shadow-xl backdrop-blur-md`}
      style={{ boxShadow: 'inset 0 0 24px rgba(255,255,255,0.15), 0 12px 32px rgba(0,0,0,0.12)' }}
    >
      {/* Glass sheen */}
      <div className="pointer-events-none absolute inset-0 z-20 rounded-b-3xl rounded-t-lg bg-gradient-to-br from-white/20 via-transparent to-white/5" />
      <div className="pointer-events-none absolute left-2 top-2 bottom-2 z-20 w-2 rounded-full bg-gradient-to-b from-white/25 to-transparent" />

      {/* Coffee fill */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 transition-[height] duration-1000 ease-out bg-gradient-to-t from-[#6f4e37] via-[#9c6f44] to-[#c99756]"
        style={{ height: mounted ? `${pct}%` : '0%' }}
      >
        <div className="absolute left-0 right-0 top-0 h-2 -translate-y-1/2 rounded-full bg-[#d4a768]/60 blur-[2px]" />
        {/* Bubbles */}
        <span className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
        <span className="absolute bottom-6 right-4 w-1 h-1 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Progress label */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold text-white drop-shadow-md">
          {Math.round(pct)}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/90 drop-shadow">
          {Math.round(currentGrains)} / {maxGrains} Grains
        </span>
      </div>

      {/* Jar neck highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-2 rounded-t-lg bg-white/15" />
    </div>
  );
}
