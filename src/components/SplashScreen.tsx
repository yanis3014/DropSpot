'use client';

import { useEffect, useState } from 'react';
import { Coffee } from '@phosphor-icons/react';

const SPLASH_DURATION_MS = 1800;
const FADE_OUT_MS = 500;

export default function SplashScreen() {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setEntered(true));
    const exit = setTimeout(() => setExiting(true), SPLASH_DURATION_MS);
    const remove = setTimeout(
      () => setDone(true),
      SPLASH_DURATION_MS + FADE_OUT_MS
    );
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(exit);
      clearTimeout(remove);
    };
  }, []);

  if (done) return null;

  return (
    <div
      aria-hidden={exiting}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-brand-espresso via-[#241610] to-brand-espresso transition-opacity duration-500 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient glow */}
      <div className="absolute w-64 h-64 rounded-full bg-brand-terracotta/15 blur-3xl" />
      <div className="absolute bottom-24 w-48 h-48 rounded-full bg-brand-matcha/10 blur-3xl" />

      {/* Logo block */}
      <div
        className={`relative flex flex-col items-center transition-all duration-700 ease-out ${
          entered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-3'
        }`}
      >
        {/* Icon tile with pulse ring */}
        <div className="relative mb-5">
          <span className="absolute inset-0 rounded-3xl bg-brand-matcha/40 animate-ping [animation-duration:2s]" />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-matcha to-brand-matcha/80 flex items-center justify-center shadow-2xl shadow-brand-matcha/30">
            <Coffee size={40} weight="duotone" className="text-white" />
          </div>
        </div>

        {/* Wordmark */}
        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          Drop<span className="text-brand-terracotta">Spot</span>
        </h1>
        <p className="mt-2 text-sm text-white/50 font-medium tracking-wide">
          Ton spot. Ta vibe.
        </p>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-20 w-28 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-brand-matcha to-brand-terracotta transition-all ease-linear ${
            entered ? 'w-full' : 'w-0'
          }`}
          style={{ transitionDuration: `${SPLASH_DURATION_MS}ms` }}
        />
      </div>
    </div>
  );
}
