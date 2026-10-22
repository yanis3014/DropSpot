'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AppleLogo,
  ArrowLeft,
  BookmarkSimple,
  CheckCircle,
  CoffeeBean,
  Envelope,
  GoogleLogo,
  Lightning,
  type Icon,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase/client';
import { WELCOME_GRAINS } from '@/lib/onboarding';
import StepLayout, { StepTitle } from './StepLayout';

const PERKS: { icon: Icon; text: string }[] = [
  { icon: CheckCircle, text: 'Tes envies sur tous tes appareils' },
  { icon: BookmarkSimple, text: 'Enregistre tes cafés préférés' },
  { icon: Lightning, text: 'Participe aux drops' },
  { icon: CoffeeBean, text: `${WELCOME_GRAINS} Grains de bienvenue` },
];

/** After sign-up the user comes back here to finish (pseudo + Grains). */
const AFTER_AUTH_PATH = '/onboarding';

interface AccountStepProps {
  onBack: () => void;
  onLater: () => void;
}

/** Guest only: create an account to keep the selection. */
export default function AccountStep({ onBack, onLater }: AccountStepProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWith = async (provider: 'google' | 'apple') => {
    if (!supabase) {
      setError("La connexion n'est pas disponible pour le moment.");
      return;
    }
    setBusy(true);
    setError(null);
    const params = new URLSearchParams({ next: AFTER_AUTH_PATH });
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${params.toString()}`,
      },
    });
    if (oauthError) {
      console.error(`${provider} sign-in error:`, oauthError);
      setError(
        provider === 'google' ? 'Connexion Google impossible.' : 'Connexion Apple impossible.'
      );
      setBusy(false);
    }
  };

  const buttonClass =
    'inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-base font-bold no-underline disabled:opacity-60';

  return (
    <StepLayout
      header={
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="-ml-2 mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ds-text2 hover:bg-ds-surface2"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
      }
      footer={
        <div className="flex flex-col gap-2.5">
          {error ? <p className="text-center text-sm text-ds-danger">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void signInWith('google')}
            className={`${buttonClass} border border-ds-line bg-ds-surface text-ds-text`}
          >
            <GoogleLogo size={20} weight="bold" aria-hidden />
            Continuer avec Google
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void signInWith('apple')}
            className={`${buttonClass} bg-ds-pin text-ds-onpin`}
          >
            <AppleLogo size={20} weight="fill" aria-hidden />
            Continuer avec Apple
          </button>
          <Link
            href={`/login?mode=signup&redirect=${encodeURIComponent(AFTER_AUTH_PATH)}`}
            className={`${buttonClass} bg-ds-surface2 text-ds-text`}
          >
            <Envelope size={20} aria-hidden />
            Continuer avec un e-mail
          </Link>
          <button
            type="button"
            onClick={onLater}
            className="h-11 w-full text-sm font-bold text-ds-text2 hover:text-ds-text"
          >
            Plus tard
          </button>
        </div>
      }
    >
      <StepTitle
        title="Garde ta sélection"
        subtitle="Un compte gratuit, et tes envies te suivent partout."
      />
      <ul className="mt-6 flex flex-col gap-3.5">
        {PERKS.map(({ icon: PerkIcon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ds-accentsoft text-ds-accenttext">
              <PerkIcon size={18} aria-hidden />
            </span>
            <span className="text-[14.5px] font-bold text-ds-text">{text}</span>
          </li>
        ))}
      </ul>
    </StepLayout>
  );
}
