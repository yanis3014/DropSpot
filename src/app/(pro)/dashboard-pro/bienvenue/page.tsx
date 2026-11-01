'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChartBar,
  Lightning,
  QrCode,
  Storefront,
  UsersThree,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import {
  fetchProAccessStatus,
  markProWelcomeSeen,
  PRO_WAITING_PATH,
} from '@/lib/pro/accessStatus';
import { hrefWithCafe } from '@/app/(pro)/hooks/useActivePlace';
import { cn } from '@/lib/cn';

/** How long the celebration plays before the tour, unless tapped. */
const CELEBRATE_MS = 3200;

type Phase = 'loading' | 'celebrate' | 'tour';

const TOUR = [
  {
    icon: Storefront,
    title: 'Ta fiche, c’est ta vitrine',
    text: 'Photos, horaires, description : c’est ce que les clients voient sur la carte avant de venir.',
  },
  {
    icon: Lightning,
    title: 'Lance des drops',
    text: 'Une offre flash pour remplir une heure creuse. Elle apparaît tout de suite dans l’app.',
  },
  {
    icon: QrCode,
    title: 'Valide au comptoir',
    text: 'Le client montre son code, tu le scannes dans « Valider ». Ça prend deux secondes.',
  },
  {
    icon: UsersThree,
    title: 'Ton équipe et ta semaine',
    text: 'Invite tes équipiers et suis qui vient, quand, et ce que tes drops rapportent.',
  },
] as const;

/** Grains that fall during the celebration (fixed positions, no randomness). */
const BEANS = [
  { left: 8, delay: 0.1, dur: 2.4, rot: -30, size: 14 },
  { left: 18, delay: 0.5, dur: 2.9, rot: 40, size: 10 },
  { left: 27, delay: 0.2, dur: 2.6, rot: 10, size: 16 },
  { left: 38, delay: 0.8, dur: 3.1, rot: -60, size: 11 },
  { left: 49, delay: 0.35, dur: 2.5, rot: 70, size: 13 },
  { left: 58, delay: 0.95, dur: 2.8, rot: -15, size: 10 },
  { left: 67, delay: 0.15, dur: 2.7, rot: 25, size: 15 },
  { left: 76, delay: 0.6, dur: 3.0, rot: -45, size: 12 },
  { left: 85, delay: 0.3, dur: 2.6, rot: 55, size: 14 },
  { left: 93, delay: 0.75, dur: 2.9, rot: -20, size: 11 },
] as const;

function Bean({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 20 26" aria-hidden>
      <ellipse cx="10" cy="13" rx="9" ry="12" fill="#e3905a" />
      <path
        d="M10 3C6.8 8 13.2 17 10 23"
        fill="none"
        stroke="#3d2719"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ProWelcomePage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState('ton café');
  const [slide, setSlide] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchProAccessStatus(supabase).then((status) => {
      if (cancelled) return;
      if (!status || status.state === 'active') {
        window.location.replace('/dashboard-pro');
        return;
      }
      if (status.state !== 'welcome' || !status.welcome) {
        window.location.replace(PRO_WAITING_PATH);
        return;
      }
      setPlaceId(status.welcome.placeId);
      setPlaceName(status.welcome.placeName);
      setPhase('celebrate');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'celebrate') return;
    const id = window.setTimeout(() => setPhase('tour'), CELEBRATE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  /** Welcome seen (once, any device), then a full load with fresh rights. */
  const finish = useCallback(
    async (href: string) => {
      if (leaving) return;
      setLeaving(true);
      await markProWelcomeSeen(supabase);
      window.location.assign(hrefWithCafe(href, placeId));
    },
    [leaving, placeId]
  );

  if (phase === 'loading') {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-ds-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  if (phase === 'celebrate') {
    return (
      <button
        type="button"
        onClick={() => setPhase('tour')}
        className="ds-welcome relative flex min-h-dvh w-full flex-1 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden border-none px-6 text-center"
        aria-label="Continuer"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {BEANS.map((b, i) => (
            <span
              key={i}
              className="ds-welcome-bean absolute -top-10"
              style={{
                left: `${b.left}%`,
                animationDelay: `${b.delay}s`,
                animationDuration: `${b.dur}s`,
                ['--bean-rot' as string]: `${b.rot}deg`,
              }}
            >
              <Bean size={b.size} />
            </span>
          ))}
        </div>

        <svg viewBox="0 0 64 64" className="ds-splash-mark" aria-hidden>
          <ellipse className="ds-splash-shadow" cx="32" cy="62" rx="9" ry="2.2" />
          <ellipse className="ds-splash-ring" cx="32" cy="61" rx="8" ry="2.4" />
          <g className="ds-splash-pin">
            <path d="M32 61C26.5 52.5 11 40.5 11 26A21 21 0 0 1 53 26C53 40.5 37.5 52.5 32 61Z" />
            <g transform="rotate(28 32 26)">
              <g className="ds-splash-bean">
                <ellipse cx="32" cy="26" rx="10.5" ry="14" />
                <path d="M32 15C28.2 21 35.8 31 32 37" />
              </g>
            </g>
          </g>
        </svg>

        <p className="ds-welcome-tag m-0 rounded-full bg-[#e3905a]/20 px-3 py-1 text-[13px] font-bold uppercase tracking-[0.08em] text-[#e3905a]">
          Demande validée
        </p>
        <h1 className="ds-welcome-title font-display m-0 max-w-md text-[34px] font-extrabold leading-tight tracking-tight text-[#f4ede6]">
          Bienvenue sur Dropspot Pro
        </h1>
        <p className="ds-welcome-sub m-0 max-w-sm text-base leading-relaxed text-[#d8cbbd]">
          {placeName} est à toi. Ton espace pro est ouvert.
        </p>
        <span className="ds-welcome-hint mt-6 text-[13px] text-[#bbad9f]">
          Touche pour continuer
        </span>
      </button>
    );
  }

  const step = TOUR[slide];
  const Icon = step.icon;
  const last = slide === TOUR.length - 1;

  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col bg-ds-bg text-ds-text">
      <header className="flex h-16 shrink-0 items-center justify-between px-5">
        <span className="font-display text-xl font-extrabold tracking-tight">
          Dropspot{' '}
          <span className="text-[13px] font-bold text-ds-text2">Pro</span>
        </span>
        {!last ? (
          <button
            type="button"
            onClick={() => void finish('/dashboard-pro')}
            disabled={leaving}
            className="border-none bg-transparent text-sm font-bold text-ds-text2"
          >
            Passer
          </button>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 pb-10">
        <div key={slide} className="animate-step flex flex-col items-center gap-5 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-ds-accentsoft text-ds-accenttext">
            <Icon size={40} weight="duotone" aria-hidden />
          </span>
          <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-ds-text2">
            {slide + 1} / {TOUR.length}
          </p>
          <h2 className="font-display m-0 text-[28px] font-extrabold leading-tight tracking-tight">
            {step.title}
          </h2>
          <p className="m-0 text-base leading-relaxed text-ds-text2">{step.text}</p>
        </div>

        <div className="flex justify-center gap-2" aria-hidden>
          {TOUR.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 rounded-full transition-all',
                i === slide ? 'w-6 bg-ds-accent' : 'w-2 bg-ds-line'
              )}
            />
          ))}
        </div>

        {last ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-center text-sm font-semibold text-ds-text2">
              Par quoi tu commences ?
            </p>
            <Button
              variant="main"
              className="w-full"
              disabled={leaving}
              onClick={() => void finish('/etablissement')}
            >
              <Storefront size={20} aria-hidden />
              Compléter ma fiche
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={leaving}
              onClick={() => void finish('/dashboard-pro')}
            >
              <ChartBar size={20} aria-hidden />
              Voir mon tableau de bord
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            {slide > 0 ? (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSlide((s) => s - 1)}
              >
                Retour
              </Button>
            ) : null}
            <Button
              variant="main"
              className="flex-1"
              onClick={() => setSlide((s) => Math.min(s + 1, TOUR.length - 1))}
            >
              Suivant
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
