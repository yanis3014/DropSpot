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

export const wifiConfig: Record<
  WifiStatus,
  { label: string; emoji: string }
> = {
  good: { label: 'Fusée', emoji: '🚀' },
  slow: { label: 'Galère', emoji: '🐌' },
};

/** Live vibe window (also used for grains cooldown). */
export const VIBE_WINDOW_MS = 3 * 60 * 60 * 1000;

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
 * Most frequent value; on a tie, the value from the most recent item wins.
 */
function modeWithRecencyTiebreak<T extends string>(
  items: { value: T; at: number }[]
): T {
  const counts = new Map<T, number>();
  const latestAt = new Map<T, number>();

  for (const item of items) {
    counts.set(item.value, (counts.get(item.value) ?? 0) + 1);
    const prev = latestAt.get(item.value) ?? 0;
    if (item.at > prev) latestAt.set(item.value, item.at);
  }

  let best: T = items[0].value;
  let bestCount = -1;
  let bestRecent = -1;

  for (const [value, count] of counts) {
    const recent = latestAt.get(value) ?? 0;
    if (
      count > bestCount ||
      (count === bestCount && recent > bestRecent)
    ) {
      best = value;
      bestCount = count;
      bestRecent = recent;
    }
  }

  return best;
}

function aggregateRows(rows: CheckIn[]): Record<string, AggregatedVibe> {
  const byPlace = new Map<string, CheckIn[]>();
  for (const row of rows) {
    const list = byPlace.get(row.place_id) ?? [];
    list.push(row);
    byPlace.set(row.place_id, list);
  }

  const out: Record<string, AggregatedVibe> = {};
  for (const [placeId, list] of byPlace) {
    const crowdVotes = list.map((c) => ({
      value: c.crowd_level,
      at: new Date(c.created_at).getTime(),
    }));
    const wifiVotes = list.map((c) => ({
      value: c.wifi_speed,
      at: new Date(c.created_at).getTime(),
    }));
    const latest = list.reduce((a, b) =>
      new Date(a.created_at).getTime() >= new Date(b.created_at).getTime() ? a : b
    );

    out[placeId] = {
      place_id: placeId,
      crowd_level: modeWithRecencyTiebreak(crowdVotes),
      wifi_speed: modeWithRecencyTiebreak(wifiVotes),
      contributors: list.length,
      latest_at: latest.created_at,
    };
  }
  return out;
}

/** All place vibes aggregated from check-ins in the last 3 hours. */
export async function getAggregatedVibes(): Promise<Record<string, AggregatedVibe>> {
  try {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      return {};
    }

    const since = new Date(Date.now() - VIBE_WINDOW_MS).toISOString();
    const { data, error } = await supabase
      .from('check_ins')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching check-ins:', error);
      return {};
    }

    return aggregateRows((data ?? []) as CheckIn[]);
  } catch (error) {
    console.error('Error in getAggregatedVibes:', error);
    return {};
  }
}

export async function getAggregatedVibe(
  placeId: string
): Promise<AggregatedVibe | null> {
  const all = await getAggregatedVibes();
  return all[placeId] ?? null;
}

/**
 * Latest-style map for legacy callers (home / map).
 * Built from the 3h consensus so cards stay Waze-like.
 */
export async function getLatestVibes(): Promise<Record<string, CheckIn>> {
  const agg = await getAggregatedVibes();
  const vibes: Record<string, CheckIn> = {};
  for (const [placeId, v] of Object.entries(agg)) {
    vibes[placeId] = {
      id: `agg-${placeId}`,
      place_id: placeId,
      user_id: '',
      crowd_level: v.crowd_level,
      wifi_speed: v.wifi_speed,
      created_at: v.latest_at,
    };
  }
  return vibes;
}

/** Most recent check-in by the current user at a place (for cooldown). */
export async function getUserLastCheckInAtPlace(
  placeId: string
): Promise<CheckIn | null> {
  try {
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('check_ins')
      .select('*')
      .eq('place_id', placeId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching last check-in:', error);
      return null;
    }
    return (data as CheckIn | null) ?? null;
  } catch (error) {
    console.error('Error in getUserLastCheckInAtPlace:', error);
    return null;
  }
}

export function formatVibeSummary(vibe: AggregatedVibe): string {
  const crowd = crowdConfig[vibe.crowd_level];
  const n = vibe.contributors;
  const who =
    n <= 1
      ? 'confirmé par 1 personne'
      : `confirmé par ${n} personnes`;
  return `${crowd.emoji} ${crowd.label} (${who})`;
}
