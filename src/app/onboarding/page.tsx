'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  MapPin,
  NavigationArrow,
  Spinner,
  UserCircle,
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/lib/hooks/useProfile';
import { needsOnboarding, type ProfilePatch } from '@/lib/api/profiles';
import { getCurrentPosition } from '@/lib/geo';
import {
  AMBIANCE_OPTIONS,
  AVATAR_PRESETS,
  answersToPreferenceIds,
  DRINK_OPTIONS,
  emptyOnboardingAnswers,
  mapFilterFromAnswers,
  MOOD_OPTIONS,
  toggleInList,
  WELCOME_GRAINS,
  WIFI_OPTIONS,
  ZONE_OPTIONS,
  type AmbianceId,
  type AvatarPreset,
  type DrinkId,
  type MoodId,
  type OnboardingAnswers,
  type WifiPriority,
  type ZoneId,
} from '@/lib/onboarding';
import type { UpsertProfileResult } from '@/lib/api/profiles';

type Step = 1 | 2 | 3 | 4 | 5;

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 z-[80] bg-brand-oat flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-matcha" />
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  emoji,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-all active:scale-[0.98] ${
        selected
          ? 'border-brand-matcha bg-brand-matcha/10 shadow-soft'
          : 'border-brand-mocha/15 bg-brand-surface hover:border-brand-matcha/35'
      }`}
    >
      <span className="flex items-start gap-3">
        {emoji && <span className="text-2xl leading-none mt-0.5">{emoji}</span>}
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-brand-espresso">
            {label}
          </span>
          {hint && (
            <span className="block text-xs text-brand-mocha mt-0.5 leading-relaxed">
              {hint}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function Chip({
  selected,
  onClick,
  emoji,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold border transition-all active:scale-95 ${
        selected
          ? 'bg-brand-ink text-white border-brand-ink'
          : 'bg-brand-surface text-brand-espresso border-brand-mocha/15'
      }`}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </button>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <OnboardingGate />
    </Suspense>
  );
}

function OnboardingGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get('edit') === '1';
  const { isAuthenticated, loading: authLoading, avatarUrl, displayName } =
    useAuth();
  const { profile, loading: profileLoading, save } = useProfile(
    isAuthenticated,
    authLoading
  );

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?redirect=/onboarding');
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
      initialAnswers={
        profile?.onboarding_answers ?? emptyOnboardingAnswers()
      }
      avatar={profile?.avatar_url ?? avatarUrl}
      alreadyClaimedWelcome={Boolean(profile?.welcome_grains_claimed_at)}
      onSave={save}
    />
  );
}

interface WizardFormProps {
  isEdit: boolean;
  initialName: string;
  initialAnswers: OnboardingAnswers;
  avatar: string | null;
  alreadyClaimedWelcome: boolean;
  onSave: (patch: ProfilePatch) => Promise<UpsertProfileResult>;
}

function WizardForm({
  isEdit,
  initialName,
  initialAnswers,
  avatar,
  alreadyClaimedWelcome,
  onSave,
}: WizardFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(initialName);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awarded, setAwarded] = useState(0);

  const trimmedName = name.trim();
  const progressStep = Math.min(step, 4);

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(answers.mood);
    if (step === 2) {
      return (
        Boolean(answers.wifi) &&
        answers.ambiances.length > 0 &&
        answers.drinks.length > 0
      );
    }
    if (step === 3) return answers.zones.length > 0;
    if (step === 4) return trimmedName.length >= 2;
    return true;
  }, [step, answers, trimmedName]);

  const patchAnswers = (partial: Partial<OnboardingAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...partial }));
  };

  const enableGeo = async () => {
    setGeoLoading(true);
    setGeoMessage(null);
    const result = await getCurrentPosition();
    setGeoLoading(false);
    if (result.ok) {
      patchAnswers({ geoEnabled: true });
      setGeoMessage('Position activée — on te montrera les spots autour de toi.');
    } else {
      patchAnswers({ geoEnabled: false });
      const reasons: Record<string, string> = {
        denied: 'Permission refusée — tu pourras l’activer plus tard sur la carte.',
        unsupported: 'Géolocalisation non disponible sur cet appareil.',
        timeout: 'Délai dépassé — réessaie depuis la carte.',
        unavailable: 'Position indisponible pour le moment.',
      };
      setGeoMessage(reasons[result.reason] ?? 'Position indisponible.');
    }
  };

  const finishDestination = () => {
    const filter = mapFilterFromAnswers(answers);
    if (filter) {
      router.replace(`/map?filter=${filter}`);
      return;
    }
    router.replace('/map');
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    setStep(5);
    try {
      const prefs = answersToPreferenceIds(answers);
      const payloadAnswers: OnboardingAnswers = {
        ...answers,
        welcomeBonus: !isEdit && !alreadyClaimedWelcome,
      };
      const result = await onSave({
        full_name: trimmedName || null,
        avatar_url: avatar,
        preferences: prefs,
        onboarding_answers: payloadAnswers,
        completeOnboarding: true,
        claimWelcomeGrains: !isEdit && !alreadyClaimedWelcome,
      });
      setAwarded(result.welcomeGrainsAwarded);
      setSaving(false);
      setTimeout(finishDestination, 2200);
    } catch (err) {
      console.error('Onboarding save error:', err);
      setError("Impossible d'enregistrer ton profil. Réessaie.");
      setSaving(false);
      setStep(4);
    }
  };

  const goNext = () => {
    setError(null);
    if (!canContinue) return;
    if (step === 4) {
      void handleFinish();
      return;
    }
    setStep((s) => (s + 1) as Step);
  };

  const goBack = () => {
    setError(null);
    if (step <= 1 || step === 5) return;
    setStep((s) => (s - 1) as Step);
  };

  const avatarEmoji =
    AVATAR_PRESETS.find((a) => a.id === answers.avatarPreset)?.emoji ?? '☕';

  return (
    <div className="fixed inset-0 z-[80] bg-brand-oat flex flex-col">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col px-6 pt-6 pb-8 overflow-hidden">
        {/* Progress */}
        {step < 5 && (
          <div className="flex items-center gap-3 mb-6 shrink-0">
            {step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                aria-label="Retour"
                className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-brand-mocha hover:bg-brand-surface transition-colors"
              >
                <ArrowLeft size={20} weight="bold" />
              </button>
            ) : (
              <span className="w-9 h-9 -ml-2" />
            )}
            <div className="flex-1 flex gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    s <= progressStep ? 'bg-brand-matcha' : 'bg-brand-espresso/10'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-brand-mocha tabular-nums w-9 text-right">
              {progressStep}/4
            </span>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide">
          {/* Étape 1 — Mood */}
          {step === 1 && (
            <div key="s1" className="flex-1 flex flex-col animate-step">
              <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
                {isEdit ? 'Ton mood du moment' : 'Bienvenue sur DropSpot'}
              </h1>
              <p className="text-brand-mocha mt-2 mb-5 text-sm leading-relaxed">
                Tu recherches plutôt un endroit pour :
              </p>
              <div className="space-y-2.5 pb-4">
                {MOOD_OPTIONS.map((opt) => (
                  <ChoiceCard
                    key={opt.id}
                    selected={answers.mood === opt.id}
                    onClick={() => patchAnswers({ mood: opt.id as MoodId })}
                    emoji={opt.emoji}
                    label={opt.label}
                    hint={opt.hint}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Étape 2 — Confort */}
          {step === 2 && (
            <div key="s2" className="flex-1 flex flex-col animate-step space-y-6 pb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
                  Tes critères de confort
                </h1>
                <p className="text-brand-mocha mt-2 text-sm">
                  On affine les spots et Flash Drops pour toi.
                </p>
              </div>

              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
                  Wi-Fi &amp; Prises
                </h2>
                {WIFI_OPTIONS.map((opt) => (
                  <ChoiceCard
                    key={opt.id}
                    selected={answers.wifi === opt.id}
                    onClick={() =>
                      patchAnswers({ wifi: opt.id as WifiPriority })
                    }
                    label={opt.label}
                    hint={opt.hint}
                  />
                ))}
              </section>

              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
                  Cadre &amp; Ambiance
                </h2>
                <div className="flex flex-wrap gap-2">
                  {AMBIANCE_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.id}
                      selected={answers.ambiances.includes(opt.id)}
                      onClick={() =>
                        patchAnswers({
                          ambiances: toggleInList(
                            answers.ambiances,
                            opt.id as AmbianceId
                          ),
                        })
                      }
                      emoji={opt.emoji}
                      label={opt.label}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
                  Boissons &amp; snacks
                </h2>
                <div className="flex flex-wrap gap-2">
                  {DRINK_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.id}
                      selected={answers.drinks.includes(opt.id)}
                      onClick={() =>
                        patchAnswers({
                          drinks: toggleInList(
                            answers.drinks,
                            opt.id as DrinkId
                          ),
                        })
                      }
                      emoji={opt.emoji}
                      label={opt.label}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Étape 3 — Localisation */}
          {step === 3 && (
            <div key="s3" className="flex-1 flex flex-col animate-step space-y-5 pb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
                  Où tu traines ?
                </h1>
                <p className="text-brand-mocha mt-2 text-sm">
                  Quartiers d’intérêt — tu peux en choisir plusieurs.
                </p>
              </div>

              <div className="space-y-2.5">
                {ZONE_OPTIONS.map((opt) => (
                  <ChoiceCard
                    key={opt.id}
                    selected={answers.zones.includes(opt.id)}
                    onClick={() =>
                      patchAnswers({
                        zones: toggleInList(answers.zones, opt.id as ZoneId),
                      })
                    }
                    emoji="📍"
                    label={opt.label}
                    hint={opt.hint}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => void enableGeo()}
                disabled={geoLoading}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 ${
                  answers.geoEnabled
                    ? 'border-brand-matcha bg-brand-matcha/10 text-brand-espresso'
                    : 'border-brand-mocha/15 bg-brand-surface text-brand-espresso'
                }`}
              >
                {geoLoading ? (
                  <Spinner size={18} className="animate-spin" />
                ) : answers.geoEnabled ? (
                  <CheckCircle size={18} weight="fill" className="text-brand-matcha" />
                ) : (
                  <NavigationArrow size={18} weight="fill" className="text-brand-matcha" />
                )}
                {answers.geoEnabled
                  ? 'Position activée'
                  : 'Activer la position pour voir les spots et Flash Drops autour de toi'}
              </button>
              {geoMessage && (
                <p className="text-xs text-brand-mocha text-center leading-relaxed">
                  {geoMessage}
                </p>
              )}
            </div>
          )}

          {/* Étape 4 — Profil + bonus */}
          {step === 4 && (
            <div key="s4" className="flex-1 flex flex-col animate-step pb-4">
              <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
                Ton identité DropSpot
              </h1>
              <p className="text-brand-mocha mt-2 mb-5 text-sm">
                Pseudo + avatar — puis{' '}
                <strong className="text-brand-espresso">
                  +{WELCOME_GRAINS} Grains
                </strong>{' '}
                de bienvenue.
              </p>

              <div className="flex justify-center mb-4">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-brand-surface shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-brand-surface ring-4 ring-brand-surface shadow-lg flex items-center justify-center text-3xl">
                    {answers.avatarPreset ? (
                      avatarEmoji
                    ) : (
                      <UserCircle
                        size={48}
                        weight="duotone"
                        className="text-brand-matcha"
                      />
                    )}
                  </div>
                )}
              </div>

              <label className="block mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-mocha">
                  Pseudo
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ton prénom ou un pseudo"
                  maxLength={40}
                  className="mt-2 w-full bg-brand-surface rounded-2xl px-5 py-3.5 text-base font-semibold text-brand-espresso border-2 border-transparent focus:border-brand-matcha focus:outline-none shadow-sm transition-all placeholder:font-normal placeholder:text-brand-mocha/50"
                />
              </label>

              <p className="text-xs font-bold uppercase tracking-wider text-brand-mocha mb-2">
                Avatar
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {AVATAR_PRESETS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      patchAnswers({ avatarPreset: a.id as AvatarPreset })
                    }
                    className={`w-12 h-12 rounded-2xl text-xl flex items-center justify-center border transition-all ${
                      answers.avatarPreset === a.id
                        ? 'border-brand-matcha bg-brand-matcha/15 scale-105'
                        : 'border-brand-mocha/15 bg-brand-surface'
                    }`}
                    aria-label={a.label}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>

              {!isEdit && !alreadyClaimedWelcome && (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">🫘</span>
                  <div>
                    <p className="text-sm font-extrabold text-brand-espresso">
                      Bonus de bienvenue
                    </p>
                    <p className="text-xs text-brand-mocha">
                      +{WELCOME_GRAINS} Grains ajoutés à ton bocal dès la
                      finalisation.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-brand-terracotta text-center mt-3">
                  {error}
                </p>
              )}
            </div>
          )}

          {/* Étape 5 — Célébration */}
          {step === 5 && (
            <div
              key="s5"
              className="flex-1 flex flex-col items-center justify-center text-center animate-pop px-2"
            >
              <div className="relative w-28 h-28 mb-5">
                <div className="absolute inset-0 rounded-full bg-brand-matcha/15 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {saving ? (
                    <Spinner
                      size={40}
                      className="animate-spin text-brand-matcha"
                    />
                  ) : (
                    <CheckCircle
                      size={64}
                      weight="fill"
                      className="text-brand-matcha"
                    />
                  )}
                </div>
              </div>

              <h1 className="text-3xl font-extrabold text-brand-espresso tracking-tight">
                {saving ? 'On prépare ton feed…' : 'Tout est prêt !'}
              </h1>
              <p className="text-brand-mocha mt-2 text-sm">
                {saving
                  ? 'Une seconde.'
                  : awarded > 0
                    ? `+${awarded} Grains dans ton bocal 🎉`
                    : 'Tes spots t’attendent sur la carte.'}
              </p>

              {!saving && awarded > 0 && (
                <div className="mt-6 rounded-2xl bg-brand-surface border border-brand-mocha/10 px-6 py-4 shadow-soft animate-pop">
                  <p className="text-4xl font-black text-amber-700 tabular-nums">
                    +{awarded}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-mocha mt-1">
                    Grains de bienvenue
                  </p>
                </div>
              )}

              {!saving && (
                <p className="mt-6 text-xs text-brand-mocha flex items-center gap-1.5">
                  <MapPin size={14} weight="fill" />
                  Redirection vers la carte…
                </p>
              )}
            </div>
          )}
        </div>

        {step < 5 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue}
            className="mt-4 w-full shrink-0 flex items-center justify-center gap-2 bg-brand-ink text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-brand-ink/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
          >
            {step === 4
              ? isEdit
                ? 'Enregistrer'
                : 'Finaliser & récupérer mes Grains'
              : 'Continuer'}
            <ArrowRight size={18} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}
