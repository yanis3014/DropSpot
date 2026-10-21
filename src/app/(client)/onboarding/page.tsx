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
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import { cn } from '@/lib/cn';

type Step = 1 | 2 | 3 | 4 | 5;

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ds-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
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
      aria-pressed={selected}
      className={cn(
        'w-full rounded-[18px] border px-4 py-3.5 text-left transition-all active:scale-[0.98]',
        selected
          ? 'border-transparent bg-ds-accentsoft shadow-ds'
          : 'border-ds-line bg-ds-surface hover:border-ds-accent/40'
      )}
    >
      <span className="flex items-start gap-3">
        {emoji ? (
          <span className="mt-0.5 text-2xl leading-none">{emoji}</span>
        ) : null}
        <span className="min-w-0">
          <span
            className={cn(
              'block text-sm font-extrabold',
              selected ? 'text-ds-accenttext' : 'text-ds-text'
            )}
          >
            {label}
          </span>
          {hint ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-ds-text2">
              {hint}
            </span>
          ) : null}
        </span>
      </span>
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
    <div className="fixed inset-0 z-[80] flex flex-col bg-ds-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden px-5 pb-8 pt-6">
        {step < 5 && (
          <div className="mb-6 flex shrink-0 items-center gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                aria-label="Retour"
                className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ds-text2 hover:bg-ds-surface2"
              >
                <ArrowLeft size={20} weight="bold" />
              </button>
            ) : (
              <span className="-ml-2 h-11 w-11" />
            )}
            <div className="flex flex-1 gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-all duration-500',
                    s <= progressStep ? 'bg-ds-accent' : 'bg-ds-surface2'
                  )}
                />
              ))}
            </div>
            <span className="w-9 text-right text-xs font-semibold tabular-nums text-ds-text2">
              {progressStep}/4
            </span>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide">
          {/* Étape 1 — Mood */}
          {step === 1 && (
            <div key="s1" className="flex-1 flex flex-col animate-step">
              <h1 className="font-display text-[28px] font-extrabold leading-tight text-ds-text">
                {isEdit ? 'Ton mood du moment' : 'Bienvenue sur DropSpot'}
              </h1>
              <p className="mb-5 mt-2 text-[15px] leading-relaxed text-ds-text2">
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
                <h1 className="font-display text-[28px] font-extrabold leading-tight text-ds-text">
                  Tes critères de confort
                </h1>
                <p className="mt-2 text-[15px] text-ds-text2">
                  On affine les spots et Flash Drops pour toi.
                </p>
              </div>

              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ds-text2">
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
                <h2 className="text-xs font-bold uppercase tracking-wider text-ds-text2">
                  Cadre &amp; Ambiance
                </h2>
                <div className="flex flex-wrap gap-2">
                  {AMBIANCE_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.id}
                      active={answers.ambiances.includes(opt.id)}
                      onClick={() =>
                        patchAnswers({
                          ambiances: toggleInList(
                            answers.ambiances,
                            opt.id as AmbianceId
                          ),
                        })
                      }
                    >
                      {opt.emoji} {opt.label}
                    </Chip>
                  ))}
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ds-text2">
                  Boissons &amp; snacks
                </h2>
                <div className="flex flex-wrap gap-2">
                  {DRINK_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.id}
                      active={answers.drinks.includes(opt.id)}
                      onClick={() =>
                        patchAnswers({
                          drinks: toggleInList(
                            answers.drinks,
                            opt.id as DrinkId
                          ),
                        })
                      }
                    >
                      {opt.emoji} {opt.label}
                    </Chip>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Étape 3 — Localisation */}
          {step === 3 && (
            <div key="s3" className="flex-1 flex flex-col animate-step space-y-5 pb-4">
              <div>
                <h1 className="font-display text-[28px] font-extrabold leading-tight text-ds-text">
                  Où tu traines ?
                </h1>
                <p className="mt-2 text-[15px] text-ds-text2">
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

              <Button
                variant={answers.geoEnabled ? 'tonal' : 'outline'}
                onClick={() => void enableGeo()}
                disabled={geoLoading}
                className="w-full whitespace-normal text-sm leading-snug"
              >
                {geoLoading ? (
                  <Spinner size={18} className="animate-spin" />
                ) : answers.geoEnabled ? (
                  <CheckCircle size={18} weight="fill" aria-hidden />
                ) : (
                  <NavigationArrow size={18} weight="regular" aria-hidden />
                )}
                {answers.geoEnabled
                  ? 'Position activée'
                  : 'Activer la position pour voir les spots autour de toi'}
              </Button>
              {geoMessage && (
                <p className="text-xs text-ds-text2 text-center leading-relaxed">
                  {geoMessage}
                </p>
              )}
            </div>
          )}

          {/* Étape 4 — Profil + bonus */}
          {step === 4 && (
            <div key="s4" className="flex-1 flex flex-col animate-step pb-4">
              <h1 className="font-display text-[28px] font-extrabold leading-tight text-ds-text">
                Ton identité DropSpot
              </h1>
              <p className="mb-5 mt-2 text-[15px] text-ds-text2">
                Pseudo + avatar — puis{' '}
                <strong className="text-ds-text">
                  +{WELCOME_GRAINS} Grains
                </strong>{' '}
                de bienvenue.
              </p>

              <div className="mb-4 flex justify-center">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 rounded-full object-cover shadow-ds ring-4 ring-ds-surface"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ds-accentsoft text-3xl shadow-ds ring-4 ring-ds-surface">
                    {answers.avatarPreset ? (
                      avatarEmoji
                    ) : (
                      <UserCircle
                        size={48}
                        weight="regular"
                        className="text-ds-accenttext"
                      />
                    )}
                  </div>
                )}
              </div>

              <label className="mb-5 block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ds-text2">
                  Pseudo
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ton prénom ou un pseudo"
                  maxLength={40}
                  className="mt-2 w-full rounded-[14px] border border-ds-line bg-ds-surface px-4 py-3.5 text-base font-semibold text-ds-text placeholder:font-normal placeholder:text-ds-text2 focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/20"
                />
              </label>

              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ds-text2">
                Avatar
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {AVATAR_PRESETS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      patchAnswers({ avatarPreset: a.id as AvatarPreset })
                    }
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-[14px] border text-xl transition-all',
                      answers.avatarPreset === a.id
                        ? 'scale-105 border-transparent bg-ds-accentsoft'
                        : 'border-ds-line bg-ds-surface'
                    )}
                    aria-label={a.label}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>

              {!isEdit && !alreadyClaimedWelcome && (
                <div className="flex items-center gap-3 rounded-[18px] border border-ds-line bg-ds-accentsoft px-4 py-3">
                  <span className="text-2xl" aria-hidden>
                    🫘
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-ds-accenttext">
                      Bonus de bienvenue
                    </p>
                    <p className="text-xs text-ds-text2">
                      +{WELCOME_GRAINS} Grains dès la finalisation.
                    </p>
                  </div>
                </div>
              )}

              {error ? (
                <p className="mt-3 text-center text-sm text-ds-accenttext">
                  {error}
                </p>
              ) : null}
            </div>
          )}

          {step === 5 && (
            <div
              key="s5"
              className="animate-pop flex flex-1 flex-col items-center justify-center px-2 text-center"
            >
              <div className="relative mb-5 h-28 w-28">
                <div className="absolute inset-0 animate-pulse rounded-full bg-ds-accentsoft" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {saving ? (
                    <Spinner
                      size={40}
                      className="animate-spin text-ds-accent"
                    />
                  ) : (
                    <CheckCircle
                      size={64}
                      weight="fill"
                      className="text-ds-ok"
                    />
                  )}
                </div>
              </div>

              <h1 className="font-display text-[28px] font-extrabold leading-tight text-ds-text">
                {saving ? 'On prépare ta carte…' : 'Tout est prêt !'}
              </h1>
              <p className="mt-2 text-[15px] text-ds-text2">
                {saving
                  ? 'Une seconde.'
                  : awarded > 0
                    ? `+${awarded} Grains dans ton solde`
                    : 'Tes spots t’attendent sur la carte.'}
              </p>

              {!saving && awarded > 0 ? (
                <div className="animate-pop mt-6 rounded-[18px] border border-ds-line bg-ds-surface px-6 py-4 shadow-ds">
                  <p className="font-display text-4xl font-extrabold tabular-nums text-ds-accenttext">
                    +{awarded}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ds-text2">
                    Grains de bienvenue
                  </p>
                </div>
              ) : null}

              {!saving ? (
                <p className="mt-6 flex items-center gap-1.5 text-xs text-ds-text2">
                  <MapPin size={14} weight="regular" aria-hidden />
                  Redirection vers la carte…
                </p>
              ) : null}
            </div>
          )}
        </div>

        {step < 5 ? (
          <Button
            variant="main"
            onClick={goNext}
            disabled={!canContinue}
            className="mt-4 w-full shrink-0"
          >
            {step === 4
              ? isEdit
                ? 'Enregistrer'
                : 'Finaliser & récupérer mes Grains'
              : 'Continuer'}
            <ArrowRight size={18} weight="bold" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
