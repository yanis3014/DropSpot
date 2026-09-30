import { supabase } from '@/lib/supabase/client';
import { isPreferenceId, PreferenceId } from '@/lib/preferences';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  preferences: PreferenceId[];
  onboarding_completed_at: string | null;
  updated_at?: string;
}

function normalize(row: Record<string, unknown>): Profile {
  const raw = Array.isArray(row.preferences) ? row.preferences : [];
  return {
    id: row.id as string,
    full_name: (row.full_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    preferences: raw.filter(isPreferenceId),
    onboarding_completed_at: (row.onboarding_completed_at as string | null) ?? null,
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
  return data ? normalize(data) : null;
}

export interface ProfilePatch {
  full_name?: string | null;
  avatar_url?: string | null;
  preferences?: PreferenceId[];
  /** Set to true to stamp onboarding_completed_at. */
  completeOnboarding?: boolean;
}

/** Insert-or-update the signed-in user's profile row. */
export async function upsertMyProfile(patch: ProfilePatch): Promise<Profile> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { completeOnboarding, ...fields } = patch;
  const payload: Record<string, unknown> = { id: user.id, ...fields };
  if (completeOnboarding) payload.onboarding_completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
  return normalize(data);
}
