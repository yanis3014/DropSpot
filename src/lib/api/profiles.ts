import { supabase } from '@/lib/supabase/client';
import { isPreferenceId, PreferenceId } from '@/lib/preferences';
import {
  emptyOnboardingAnswers,
  parseOnboardingAnswers,
  type OnboardingAnswers,
  WELCOME_GRAINS,
} from '@/lib/onboarding';
import { addGrains } from '@/lib/grains';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  preferences: PreferenceId[];
  onboarding_answers: OnboardingAnswers;
  onboarding_completed_at: string | null;
  grains_balance: number;
  welcome_grains_claimed_at: string | null;
  updated_at?: string;
}

function normalize(row: Record<string, unknown>): Profile {
  const raw = Array.isArray(row.preferences) ? row.preferences : [];
  const grains =
    typeof row.grains_balance === 'number' && Number.isFinite(row.grains_balance)
      ? Math.max(0, Math.floor(row.grains_balance))
      : 0;

  return {
    id: row.id as string,
    full_name: (row.full_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    preferences: raw.filter(isPreferenceId),
    onboarding_answers: parseOnboardingAnswers(row.onboarding_answers),
    onboarding_completed_at:
      (row.onboarding_completed_at as string | null) ?? null,
    grains_balance: grains,
    welcome_grains_claimed_at:
      (row.welcome_grains_claimed_at as string | null) ?? null,
    updated_at: row.updated_at as string | undefined,
  };
}

export function needsOnboarding(profile: Profile | null): boolean {
  return !profile?.onboarding_completed_at;
}

/** Profile of the signed-in user, or null for guests / missing row. */
export async function getMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data ? normalize(data as Record<string, unknown>) : null;
}

export interface ProfilePatch {
  full_name?: string | null;
  avatar_url?: string | null;
  preferences?: PreferenceId[];
  onboarding_answers?: OnboardingAnswers;
  /** Set to true to stamp onboarding_completed_at. */
  completeOnboarding?: boolean;
  /** Crédite +50 Grains une seule fois (première finalisation). */
  claimWelcomeGrains?: boolean;
}

export interface UpsertProfileResult {
  profile: Profile;
  welcomeGrainsAwarded: number;
}

/** Insert-or-update the signed-in user's profile row. */
export async function upsertMyProfile(
  patch: ProfilePatch
): Promise<UpsertProfileResult> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { completeOnboarding, claimWelcomeGrains, ...fields } = patch;

  const { data: existing } = await supabase
    .from('profiles')
    .select('grains_balance, welcome_grains_claimed_at')
    .eq('id', user.id)
    .maybeSingle();

  const alreadyClaimed = Boolean(
    (existing as { welcome_grains_claimed_at?: string | null } | null)
      ?.welcome_grains_claimed_at
  );
  const currentGrains = (() => {
    const g = (existing as { grains_balance?: number } | null)?.grains_balance;
    return typeof g === 'number' && Number.isFinite(g)
      ? Math.max(0, Math.floor(g))
      : 0;
  })();

  // Bonus uniquement à la 1ère complétion d'onboarding
  const awardWelcome =
    Boolean(completeOnboarding) &&
    Boolean(claimWelcomeGrains) &&
    !alreadyClaimed;

  const payload: Record<string, unknown> = { id: user.id, ...fields };
  if (completeOnboarding) {
    payload.onboarding_completed_at = new Date().toISOString();
  }

  let welcomeGrainsAwarded = 0;
  if (awardWelcome) {
    welcomeGrainsAwarded = WELCOME_GRAINS;
    payload.grains_balance = currentGrains + WELCOME_GRAINS;
    payload.welcome_grains_claimed_at = new Date().toISOString();
    if (fields.onboarding_answers) {
      payload.onboarding_answers = {
        ...fields.onboarding_answers,
        welcomeBonus: true,
      };
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    if (
      error.code === '42703' ||
      /onboarding_answers|welcome_grains|grains_balance/.test(error.message ?? '')
    ) {
      const fallbackPayload: Record<string, unknown> = {
        id: user.id,
        full_name: fields.full_name,
        avatar_url: fields.avatar_url,
        preferences: fields.preferences,
      };
      if (completeOnboarding) {
        fallbackPayload.onboarding_completed_at = new Date().toISOString();
      }
      const fallback = await supabase
        .from('profiles')
        .upsert(fallbackPayload, { onConflict: 'id' })
        .select('*')
        .single();
      if (fallback.error) {
        console.error('Error saving profile:', fallback.error);
        throw fallback.error;
      }
      if (awardWelcome) {
        welcomeGrainsAwarded = WELCOME_GRAINS;
        addGrains(WELCOME_GRAINS);
      }
      return {
        profile: normalize({
          ...(fallback.data as Record<string, unknown>),
          onboarding_answers:
            fields.onboarding_answers ?? emptyOnboardingAnswers(),
          grains_balance: awardWelcome
            ? currentGrains + WELCOME_GRAINS
            : currentGrains,
        }),
        welcomeGrainsAwarded,
      };
    }
    console.error('Error saving profile:', error);
    throw error;
  }

  if (welcomeGrainsAwarded > 0) {
    addGrains(welcomeGrainsAwarded);
  }

  return {
    profile: normalize(data as Record<string, unknown>),
    welcomeGrainsAwarded,
  };
}
