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

/** Consensus vibe for a place over the last few hours. */
export interface AggregatedVibe {
  place_id: string;
  crowd_level: CrowdLevel;
  wifi_speed: WifiStatus;
  contributors: number;
  latest_at: string;
}

export const crowdConfig: Record<
  CrowdLevel,
  { label: string; sublabel: string; emoji: string; classes: string }
> = {
  quiet: {
    label: 'Calme',
    sublabel: 'Peu de monde',
    emoji: '👻',
    classes: 'bg-ds-ok/10 text-ds-ok',
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
    classes: 'bg-ds-accent/10 text-ds-accent',
  },
};

export const wifiConfig: Record<
  WifiStatus,
  { label: string; emoji: string }
> = {
  good: { label: 'Fusée', emoji: '🚀' },
  slow: { label: 'Galère', emoji: '🐌' },
};

/** Live vibe window (same as the server check-in cooldown). */
export const VIBE_WINDOW_MS = 3 * 60 * 60 * 1000;

export type CheckInError =
  | 'not_authenticated'
  | 'invalid_input'
  | 'no_gps'
  | 'not_found'
  | 'too_far';

export type CheckInResult =
  | {
      ok: true;
      grainsAwarded: number;
      /** Why the reward is what it is (0 Grain on cooldown / daily cap). */
      reason: 'ok' | 'cooldown' | 'daily_cap';
    }
  | { ok: false; error: CheckInError; distanceM?: number };

/**
 * Check-in through the `check_in` RPC: the server checks the distance,
 * the 3 h cooldown and the daily cap, and credits the Grains.
 */
export async function checkIn(input: {
  placeId: string;
  crowd: CrowdLevel;
  wifi: WifiStatus;
  coords: { lat: number; lng: number } | null;
}): Promise<CheckInResult> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await supabase.rpc('check_in', {
    p_place: input.placeId,
    p_crowd: input.crowd,
    p_wifi: input.wifi,
    p_lat: input.coords?.lat ?? null,
    p_lng: input.coords?.lng ?? null,
  });
  if (error) throw error;

  const row = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    distance_m?: number;
    grains_awarded?: number;
    reason?: string;
  };
  if (!row.ok) {
    return {
      ok: false,
      error: (row.error as CheckInError) ?? 'not_found',
      distanceM:
        typeof row.distance_m === 'number' ? row.distance_m : undefined,
    };
  }
  const reason =
    row.reason === 'cooldown' || row.reason === 'daily_cap' ? row.reason : 'ok';
  return { ok: true, grainsAwarded: row.grains_awarded ?? 0, reason };
}

type VibeRow = {
  place_id: string;
  crowd_level: CrowdLevel | null;
  wifi_speed: WifiStatus | null;
  contributors: number;
  latest_at: string;
};

/**
 * Live vibes (last 3 h) from the `get_place_vibes` RPC, keyed by place.
 * Check-ins themselves are private: the RPC never returns user ids.
 */
export async function getAggregatedVibes(
  placeId?: string
): Promise<Record<string, AggregatedVibe>> {
  try {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      return {};
    }
    const { data, error } = await supabase.rpc(
      'get_place_vibes',
      placeId ? { p_place: placeId } : {}
    );
    if (error) {
      console.error('Error fetching vibes:', error);
      return {};
    }
    const out: Record<string, AggregatedVibe> = {};
    for (const row of (data ?? []) as VibeRow[]) {
      if (!row.crowd_level || !row.wifi_speed) continue;
      out[row.place_id] = {
        place_id: row.place_id,
        crowd_level: row.crowd_level,
        wifi_speed: row.wifi_speed,
        contributors: row.contributors,
        latest_at: row.latest_at,
      };
    }
    return out;
  } catch (error) {
    console.error('Error in getAggregatedVibes:', error);
    return {};
  }
}

/** Live vibe of one café, or null when nobody checked in for 3 h. */
export async function getPlaceVibe(
  placeId: string
): Promise<AggregatedVibe | null> {
  const all = await getAggregatedVibes(placeId);
  return all[placeId] ?? null;
}
