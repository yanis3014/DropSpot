'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle, UserCircle } from '@phosphor-icons/react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/lib/hooks/useProfile';
import { needsOnboarding, ProfilePatch } from '@/lib/api/profiles';
import { PreferenceId } from '@/lib/preferences';
import PreferencePills from '@/components/profile/PreferencePills';

type Step = 1 | 2 | 3;

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 z-[80] bg-brand-oat flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-matcha" />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get('edit') === '1';
  const { isAuthenticated, loading: authLoading, avatarUrl, displayName } = useAuth();
  const { profile, loading: profileLoading, save } = useProfile(isAuthenticated, authLoading);

  // Guests can't onboard; returning users with a finished profile go home.
  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!isEdit && !needsOnboarding(profile)) router.replace('/');
  }, [authLoading, profileLoading, isAuthenticated, profile, isEdit, router]);

  if (authLoading || profileLoading || !isAuthenticated) {
    return <FullScreenSpinner />;
  }

  return (
    <WizardForm
      isEdit={isEdit}
      initialName={profile?.full_name ?? displayName ?? ''}
      initialPrefs={profile?.preferences ?? []}
      avatar={profile?.avatar_url ?? avatarUrl}
      onSave={save}
      onDone={() => router.replace('/')}
    />
  );
}

interface WizardFormProps {
  isEdit: boolean;
  initialName: string;
  initialPrefs: PreferenceId[];
  avatar: string | null;
  onSave: (patch: ProfilePatch) => Promise<unknown>;
  onDone: () => void;
}

function WizardForm({ isEdit, initialName, initialPrefs, avatar, onSave, onDone }: WizardFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(initialName);
  const [prefs, setPrefs] = useState<PreferenceId[]>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();

  const handleFinish = async () => {
    setStep(3);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        full_name: trimmedName || null,
        avatar_url: avatar,
        preferences: prefs,
        completeOnboarding: true,
      });
      // Let the success state breathe before leaving.
      setTimeout(onDone, 900);
    } catch (err) {
      console.error('Onboarding save error:', err);
      setError("Impossible d'enregistrer ton profil. Réessaie.");
      setSaving(false);
      setStep(2);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-brand-oat flex flex-col">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col px-6 pt-6 pb-8">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {step > 1 && step < 3 ? (
            <button
              onClick={() => setStep(1)}
              aria-label="Retour"
              className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-brand-mocha hover:bg-brand-surface transition-colors"
            >
              <ArrowLeft size={20} weight="bold" />
            </button>
          ) : (
            <span className="w-9 h-9 -ml-2" />
          )}
          <div className="flex-1 flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  s <= step ? 'bg-brand-matcha' : 'bg-brand-espresso/10'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-brand-mocha tabular-nums w-9 text-right">
            {Math.min(step, 3)}/3
          </span>
        </div>

        {/* Step 1: name */}
        {step === 1 && (
          <div key="step-1" className="flex-1 flex flex-col animate-step">
            <div className="flex justify-center mb-6">
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-brand-surface shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-brand-surface ring-4 ring-brand-surface shadow-lg flex items-center justify-center">
                  <UserCircle size={56} weight="duotone" className="text-brand-matcha" />
                </div>
              )}
            </div>
            <h1 className="text-3xl font-extrabold text-brand-espresso tracking-tight text-center">
              {isEdit ? 'Ton profil' : 'Bienvenue sur DropSpot 👋'}
            </h1>
            <p className="text-brand-mocha text-center mt-2 mb-8">
              Comment veux-tu qu&apos;on t&apos;appelle ?
            </p>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-mocha">
                Pseudo
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && trimmedName && setStep(2)}
                placeholder="Ton prénom ou un pseudo"
                maxLength={40}
                autoFocus
                className="mt-2 w-full bg-brand-surface rounded-2xl px-5 py-4 text-lg font-semibold text-brand-espresso border-2 border-transparent focus:border-brand-matcha focus:outline-none shadow-sm transition-all placeholder:font-normal placeholder:text-brand-mocha/50"
              />
            </label>
            <p className="text-xs text-brand-mocha mt-2">
              Visible sur tes check-ins et dans le feed.
            </p>

            <div className="flex-1" />
            <button
              onClick={() => setStep(2)}
              disabled={!trimmedName}
              className="w-full flex items-center justify-center gap-2 bg-brand-ink text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-brand-ink/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
            >
              Continuer
              <ArrowRight size={18} weight="bold" />
            </button>
          </div>
        )}

        {/* Step 2: preferences */}
        {step === 2 && (
          <div key="step-2" className="flex-1 flex flex-col animate-step">
            <h1 className="text-3xl font-extrabold text-brand-espresso tracking-tight">
              {trimmedName ? `${trimmedName.split(' ')[0]}, ` : ''}tu viens au café pour…
            </h1>
            <p className="text-brand-mocha mt-2 mb-6">
              Choisis tout ce qui te parle. On adapte ton feed.
            </p>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 pb-4">
              <PreferencePills value={prefs} onChange={setPrefs} />
            </div>

            {error && (
              <p className="text-sm text-brand-terracotta text-center mb-3">{error}</p>
            )}

            <button
              onClick={handleFinish}
              disabled={prefs.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-brand-matcha text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-matcha/25 hover:bg-brand-matcha/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
            >
              {prefs.length === 0
                ? 'Choisis au moins un style'
                : isEdit
                  ? 'Enregistrer'
                  : `C'est parti (${prefs.length})`}
            </button>
          </div>
        )}

        {/* Step 3: saving / done */}
        {step === 3 && (
          <div key="step-3" className="flex-1 flex flex-col items-center justify-center text-center animate-step">
            <div className="relative w-24 h-24 mb-6">
              <div
                className={`absolute inset-0 rounded-full bg-brand-matcha/10 transition-transform duration-700 ${
                  saving ? 'scale-100 animate-pulse' : 'scale-125'
                }`}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {saving ? (
                  <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-matcha" />
                ) : (
                  <CheckCircle size={56} weight="fill" className="text-brand-matcha animate-step" />
                )}
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-brand-espresso tracking-tight">
              {saving ? 'On prépare ton feed…' : 'Tout est prêt !'}
            </h1>
            <p className="text-brand-mocha mt-2">
              {saving ? 'Une seconde.' : 'Tes spots t’attendent.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
