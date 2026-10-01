import { supabase } from '@/lib/supabase/client';

export type CrowdLevel = 'quiet' | 'moderate' | 'full';
export type WifiStatus = 'good' | 'slow';

export interface CheckIn {
  id: string;
  place_id: string;
  user_id: string;
  crowd_level: CrowdLevel;
  wifi_speed: WifiStatus;
  created_at: string;
}

export const crowdConfig: Record<
  CrowdLevel,
  { label: string; sublabel: string; emoji: string; classes: string }
> = {
  quiet: {
    label: 'Calme',
    sublabel: 'Peu de monde',
    emoji: '👻',
    classes: 'bg-brand-matcha/10 text-brand-matcha',
  },
  moderate: {
    label: 'Animé',
    sublabel: 'Ça bouge',
    emoji: '🐝',
    classes: 'bg-amber-500/10 text-amber-600',
  },
  full: {
    label: 'Blindé',
    sublabel: 'Complet',
    emoji: '🥵',
    classes: 'bg-brand-terracotta/10 text-brand-terracotta',
  },
};

// A check-in stays relevant for a few hours only
const VIBE_FRESHNESS_MS = 6 * 60 * 60 * 1000;

export async function createCheckIn(input: {
  place_id: string;
  crowd_level: CrowdLevel;
  wifi_speed: WifiStatus;
}): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('check_ins').insert({
    place_id: input.place_id,
    user_id: user.id,
    crowd_level: input.crowd_level,
    wifi_speed: input.wifi_speed,
  });

  if (error) {
    console.error('Error creating check-in:', error);
    throw error;
  }
}

/**
 * Latest fresh check-in per place, keyed by place_id.
 * Only considers check-ins from the last few hours.
 */
export async function getLatestVibes(): Promise<Record<string, CheckIn>> {
  try {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      return {};
    }

    const since = new Date(Date.now() - VIBE_FRESHNESS_MS).toISOString();

    const { data, error } = await supabase
      .from('check_ins')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching check-ins:', error);
      return {};
    }

    const vibes: Record<string, CheckIn> = {};
    for (const row of (data ?? []) as CheckIn[]) {
      if (!vibes[row.place_id]) vibes[row.place_id] = row;
    }
    return vibes;
  } catch (error) {
    console.error('Error in getLatestVibes:', error);
    return {};
  }
}
