'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/lib/hooks/useProfile';
import {
  needsOnboarding,
  type ProfilePatch,
  type UpsertProfileResult,
} from '@/lib/api/profiles';
import { getPlaces, type Place } from '@/lib/api/places';
import { getActiveDrops, type Drop } from '@/lib/api/drops';
import { safeRedirectPath } from '@/lib/auth/redirect';
import { getCurrentPosition, type LatLng } from '@/lib/geo';
import { filtersQueryString } from '@/lib/mapFilters';
import {
  answersToPreferenceIds,
  AVATAR_COLORS,
  emptyOnboardingAnswers,
  needsForEnvies,
  ZONE_OPTIONS,
  type AvatarColorId,
  type OnboardingAnswers,
} from '@/lib/onboarding';
import {
  markLocalOnboardingSkipped,
  markLocalOnboardingSynced,
  pendingLocalAnswers,
  readLocalOnboarding,
  saveLocalOnboarding,
} from '@/lib/onboardingStorage';
import {
  mapFiltersForAnswers,
  pickDropForAnswers,
  rankPlaces,
  referencePoint,
} from '@/lib/onboardingSelection';
import AccountStep from '@/components/onboarding/AccountStep';
import EnviesStep from '@/components/onboarding/EnviesStep';
import GrainsStep from '@/components/onboarding/GrainsStep';
import NeedsStep from '@/components/onboarding/NeedsStep';
import ProfileStep, { MIN_NAME_LENGTH } from '@/components/onboarding/ProfileStep';
import SelectionStep from '@/components/onboarding/SelectionStep';
import StepHeader from '@/components/onboarding/StepHeader';
import WelcomeStep from '@/components/onboarding/WelcomeStep';
import WhereStep from '@/components/onboarding/WhereStep';

/**
 * - `guest`: no account yet. Envies stay on the device until sign-up.
 * - `signup`: signed in, profile not completed (pseudo + welcome Grains).
 * - `edit`: signed in, changing envies from the profile.
 */
type Mode = 'guest' | 'signup' | 'edit';

type Step =
  | 'welcome'
  | 'envies'
  | 'needs'
  | 'where'
  | 'selection'
  | 'account'
  | 'profile'
  | 'grains';

const QUESTION_STEPS = ['envies', 'needs', 'where'] as const;

const GEO_ERRORS: Record<string, string> = {
  denied: 'Position refusée : choisis plutôt tes quartiers.',
  unsupported: 'Géolocalisation non disponible sur cet appareil.',
  timeout: 'Délai dépassé : réessaie ou choisis tes quartiers.',
  unavailable: 'Position indisponible pour le moment.',
};

function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ds-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
    </div>
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
  const wantsEdit = searchParams.get('edit') === '1';
  const rawNext = searchParams.get('next');
  const safeNext = rawNext ? safeRedirectPath(rawNext) : null;
  const next = safeNext && !safeNext.startsWith('/onboarding') ? safeNext : null;
  const { isAuthenticated, loading: authLoading, avatarUrl, displayName } = useAuth();
  const { profile, loading: profileLoading, save } = useProfile(
    isAuthenticated,
    authLoading
  );

  // Decided once: saving the profile mid-flow must not bounce the user away
  // before the Grains screen.
  const [mode, setMode] = useState<Mode | 'done' | null>(null);
  if (mode === null && !authLoading && !profileLoading) {
    if (!isAuthenticated) setMode('guest');
    else if (wantsEdit) setMode('edit');
    else setMode(needsOnboarding(profile) ? 'signup' : 'done');
  }

  useEffect(() => {
    if (mode === 'done') router.replace(next ?? '/');
  }, [mode, next, router]);

  if (mode === null || mode === 'done') return <FullScreenSpinner />;

  return (
    <OnboardingFlow
      mode={mode}
      next={next}
      profileAnswers={profile?.onboarding_answers ?? null}
      initialName={profile?.full_name ?? displayName ?? ''}
      photoUrl={profile?.avatar_url ?? avatarUrl ?? null}
      alreadyClaimedWelcome={Boolean(profile?.welcome_grains_claimed_at)}
      onSave={save}
    />
  );
}

interface OnboardingFlowProps {
  mode: Mode;
  next: string | null;
  profileAnswers: OnboardingAnswers | null;
  initialName: string;
  photoUrl: string | null;
  alreadyClaimedWelcome: boolean;
  onSave: (patch: ProfilePatch) => Promise<UpsertProfileResult>;
}

function initialState(mode: Mode, profileAnswers: OnboardingAnswers | null) {
  if (mode === 'guest') {
    const local = readLocalOnboarding();
    return {
      step: 'welcome' as Step,
      answers: local?.answers ?? emptyOnboardingAnswers(),
    };
  }
  if (mode === 'signup') {
    const pending = pendingLocalAnswers();
    if (pending) return { step: 'profile' as Step, answers: pending };
    const fromProfile =
      profileAnswers && profileAnswers.envies.length > 0 ? profileAnswers : null;
    return { step: 'envies' as Step, answers: fromProfile ?? emptyOnboardingAnswers() };
  }
  return { step: 'envies' as Step, answers: profileAnswers ?? emptyOnboardingAnswers() };
}

function OnboardingFlow({
  mode,
  next,
  profileAnswers,
  initialName,
  photoUrl,
  alreadyClaimedWelcome,
  onSave,
}: OnboardingFlowProps) {
  const router = useRouter();
  const [initial] = useState(() => initialState(mode, profileAnswers));
  const [step, setStep] = useState<Step>(initial.step);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initial.answers);
  // Needs are pre-filled from the envies until the user edits them.
  const [needsTouched, setNeedsTouched] = useState(initial.answers.envies.length > 0);

  const [position, setPosition] = useState<LatLng | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  const [places, setPlaces] = useState<Place[] | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);

  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<AvatarColorId>(
    initial.answers.avatarColor ?? AVATAR_COLORS[0].id
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awarded, setAwarded] = useState(0);

  // Cafés + drops for the selection screen and the map filters.
  useEffect(() => {
    if (mode === 'edit') return;
    let cancelled = false;
    Promise.all([
      getPlaces().catch(() => [] as Place[]),
      getActiveDrops().catch(() => [] as Drop[]),
    ]).then(([placeRows, dropRows]) => {
      if (cancelled) return;
      setPlaces(placeRows);
      setDrops(dropRows);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Position was allowed earlier (or on another visit): read it again silently.
  useEffect(() => {
    if (step !== 'selection' || position || !answers.geoEnabled) return;
    let cancelled = false;
    void getCurrentPosition({ timeout: 8_000, maximumAge: 300_000 }).then((result) => {
      if (!cancelled && result.ok) setPosition(result.coords);
    });
    return () => {
      cancelled = true;
    };
  }, [step, position, answers.geoEnabled]);

  const patchAnswers = (partial: Partial<OnboardingAnswers>) =>
    setAnswers((prev) => ({ ...prev, ...partial }));

  const selection = useMemo(() => {
    if (!places) return null;
    return rankPlaces(places, answers, referencePoint(answers, position));
  }, [places, answers, position]);

  const drop = useMemo(() => pickDropForAnswers(drops, answers), [drops, answers]);

  const mapHref = useMemo(
    () => `/map${filtersQueryString(mapFiltersForAnswers(answers, places ?? []))}`,
    [answers, places]
  );

  const zoneLabel =
    ZONE_OPTIONS.find((z) => answers.zones.includes(z.id))?.label ?? null;

  const enableGeo = async () => {
    setGeoLoading(true);
    setGeoMessage(null);
    const result = await getCurrentPosition();
    setGeoLoading(false);
    if (result.ok) {
      setPosition(result.coords);
      patchAnswers({ geoEnabled: true });
    } else {
      patchAnswers({ geoEnabled: false });
      setGeoMessage(GEO_ERRORS[result.reason] ?? 'Position indisponible.');
    }
  };

  const goToNeeds = () => {
    if (answers.envies.length === 0) return;
    const suggested = needsForEnvies(answers.envies);
    patchAnswers({
      needs: needsTouched
        ? Array.from(new Set([...answers.needs, ...suggested]))
        : suggested,
    });
    setStep('needs');
  };

  const goToSelection = () => {
    if (mode === 'guest') saveLocalOnboarding(answers);
    setStep('selection');
  };

  const finishAsGuest = () => {
    saveLocalOnboarding(answers);
    router.replace(mapHref);
  };

  const skipAsGuest = () => {
    markLocalOnboardingSkipped();
    router.replace('/map');
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        preferences: answersToPreferenceIds(answers),
        onboarding_answers: answers,
      });
      router.replace('/profile');
    } catch (err) {
      console.error('Onboarding edit save error:', err);
      setError("Impossible d'enregistrer tes envies. Réessaie.");
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    const trimmed = name.trim();
    if (trimmed.length < MIN_NAME_LENGTH) return;
    setSaving(true);
    setError(null);
    const claim = !alreadyClaimedWelcome;
    const finalAnswers: OnboardingAnswers = {
      ...answers,
      avatarColor: photoUrl ? answers.avatarColor : color,
      welcomeBonus: claim || answers.welcomeBonus,
    };
    try {
      const result = await onSave({
        full_name: trimmed,
        avatar_url: photoUrl,
        preferences: answersToPreferenceIds(finalAnswers),
        onboarding_answers: finalAnswers,
        completeOnboarding: true,
        claimWelcomeGrains: claim,
      });
      markLocalOnboardingSynced();
      setAwarded(result.welcomeGrainsAwarded);
      setStep('grains');
    } catch (err) {
      console.error('Onboarding save error:', err);
      setError("Impossible d'enregistrer ton profil. Réessaie.");
    } finally {
      setSaving(false);
    }
  };

  const questionIndex = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]);
  const header =
    questionIndex >= 0 ? (
      <StepHeader
        step={questionIndex + 1}
        total={QUESTION_STEPS.length}
        onBack={
          step === 'needs'
            ? () => setStep('envies')
            : step === 'where'
              ? () => setStep('needs')
              : mode === 'guest'
                ? () => setStep('welcome')
                : mode === 'edit'
                  ? () => router.replace('/profile')
                  : undefined
        }
        onSkip={step === 'envies' && mode === 'guest' ? skipAsGuest : undefined}
      />
    ) : null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-ds-bg">
      {step === 'welcome' && (
        <WelcomeStep
          onStart={() => setStep('envies')}
          onLogin={() => router.push('/login?redirect=/map')}
        />
      )}

      {step === 'envies' && (
        <EnviesStep
          key="envies"
          header={header}
          value={answers.envies}
          onChange={(envies) => patchAnswers({ envies })}
          onNext={goToNeeds}
        />
      )}

      {step === 'needs' && (
        <NeedsStep
          key="needs"
          header={header}
          value={answers.needs}
          onChange={(needs) => {
            setNeedsTouched(true);
            patchAnswers({ needs });
          }}
          onNext={() => setStep('where')}
          onSkip={() => {
            setNeedsTouched(true);
            patchAnswers({ needs: [] });
            setStep('where');
          }}
        />
      )}

      {step === 'where' && (
        <WhereStep
          key="where"
          header={header}
          geoEnabled={answers.geoEnabled}
          geoLoading={geoLoading}
          geoMessage={geoMessage}
          onEnableGeo={() => void enableGeo()}
          zones={answers.zones}
          onZonesChange={(zones) => patchAnswers({ zones })}
          nextLabel={mode === 'edit' ? 'Enregistrer mes envies' : 'Voir ma sélection'}
          busy={saving}
          error={error}
          onNext={mode === 'edit' ? () => void saveEdit() : goToSelection}
        />
      )}

      {step === 'selection' && (
        <SelectionStep
          key="selection"
          loading={places === null}
          selection={selection}
          drop={drop}
          fromPosition={position !== null}
          zoneLabel={zoneLabel}
          primaryLabel={mode === 'guest' ? 'Voir ma carte' : 'Continuer'}
          onPrimary={mode === 'guest' ? finishAsGuest : () => setStep('profile')}
          onKeep={mode === 'guest' ? () => setStep('account') : undefined}
        />
      )}

      {step === 'account' && (
        <AccountStep
          key="account"
          onBack={() => setStep('selection')}
          onLater={finishAsGuest}
        />
      )}

      {step === 'profile' && (
        <ProfileStep
          key="profile"
          name={name}
          onNameChange={setName}
          photoUrl={photoUrl}
          color={color}
          onColorChange={setColor}
          saving={saving}
          error={error}
          onSubmit={() => void saveProfile()}
        />
      )}

      {step === 'grains' && (
        <GrainsStep
          key="grains"
          name={name}
          awarded={awarded}
          primaryLabel={next ? 'Continuer' : 'Voir ma carte'}
          onContinue={() => router.replace(next ?? mapHref)}
        />
      )}
    </div>
  );
}
