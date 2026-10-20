import { supabase } from '@/lib/supabase/client';
import { isPreferenceId, PreferenceId } from '@/lib/preferences';
import {
  emptyOnboardingAnswers,
  parseOnboardingAnswers,
  type OnboardingAnswers,
} from '@/lib/onboarding';

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
  /**
   * After onboarding is completed, ask the server RPC to credit +50 Grains
   * once (`claim_welcome_grains`). Never written from the client.
   */
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

  // Never send grains_balance / welcome_grains_claimed_at — server-owned columns.
  const payload: Record<string, unknown> = { id: user.id, ...fields };
  delete payload.grains_balance;
  delete payload.welcome_grains_claimed_at;

  if (completeOnboarding) {
    payload.onboarding_completed_at = new Date().toISOString();
  }

  if (claimWelcomeGrains && fields.onboarding_answers) {
    payload.onboarding_answers = {
      ...fields.onboarding_answers,
      welcomeBonus: true,
    };
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
      if (fields.onboarding_answers) {
        fallbackPayload.onboarding_answers = payload.onboarding_answers;
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

      let welcomeGrainsAwarded = 0;
      if (completeOnboarding && claimWelcomeGrains) {
        welcomeGrainsAwarded = await claimWelcomeGrainsRpc();
      }

      const refreshed = (await getMyProfile()) ??
        normalize({
          ...(fallback.data as Record<string, unknown>),
          onboarding_answers:
            fields.onboarding_answers ?? emptyOnboardingAnswers(),
        });

      return { profile: refreshed, welcomeGrainsAwarded };
    }
    console.error('Error saving profile:', error);
    throw error;
  }

  let welcomeGrainsAwarded = 0;
  if (completeOnboarding && claimWelcomeGrains) {
    welcomeGrainsAwarded = await claimWelcomeGrainsRpc();
  }

  const refreshed =
    (await getMyProfile()) ?? normalize(data as Record<string, unknown>);

  return {
    profile: refreshed,
    welcomeGrainsAwarded,
  };
}

/** Server-side welcome credit; returns 0 if already claimed / not eligible. */
async function claimWelcomeGrainsRpc(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('claim_welcome_grains');
  if (error) {
    console.error('claim_welcome_grains RPC error:', error);
    return 0;
  }
  return typeof data === 'number' && Number.isFinite(data)
    ? Math.max(0, Math.floor(data))
    : 0;
}
