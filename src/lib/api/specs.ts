import { supabase } from '@/lib/supabase/client';
import { cachedQuery, invalidateCache } from '@/lib/cache/clientCache';
import {
  groupSpecsByPlace,
  isSpecId,
  type PlaceSpec,
  type PlaceSpecMap,
  type SpecId,
  type SpecsByPlace,
  type SpecStatus,
} from '@/lib/specs';

function toPlaceSpec(row: Record<string, unknown>): PlaceSpec | null {
  if (!isSpecId(row.spec)) return null;
  return {
    place_id: String(row.place_id),
    spec: row.spec,
    declared: Boolean(row.declared),
    yes_votes: Number(row.yes_votes ?? 0),
    no_votes: Number(row.no_votes ?? 0),
    score: Number(row.score ?? 0),
    status: (row.status as SpecStatus) ?? 'pending',
    last_vote_at: (row.last_vote_at as string | null) ?? null,
  };
}

async function fetchSpecs(placeId: string | null): Promise<PlaceSpec[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_place_specs', {
    p_place: placeId,
  });
  if (error) {
    console.error('Error fetching place specs:', error);
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[])
    .map(toPlaceSpec)
    .filter((s): s is PlaceSpec => s !== null);
}

/** Specificities of every café (map and list filters). */
export async function getAllPlaceSpecs(): Promise<SpecsByPlace> {
  return cachedQuery('specs:all', async () => groupSpecsByPlace(await fetchSpecs(null)));
}

/** Most cafés per get_places_specs call (server cap). */
const SPECS_BATCH = 1000;

/**
 * Specificities of the listed cafés (get_places_specs, cached server-side).
 * Falls back to every café's specificities while the SQL function is not
 * deployed.
 */
export async function getPlacesSpecs(placeIds: string[]): Promise<SpecsByPlace> {
  const ids = [...new Set(placeIds.filter(Boolean))];
  if (!supabase || ids.length === 0) return {};
  const client = supabase;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += SPECS_BATCH) batches.push(ids.slice(i, i + SPECS_BATCH));
  const rows: PlaceSpec[] = [];
  for (const batch of batches) {
    const { data, error } = await client.rpc('get_places_specs', { p_place_ids: batch });
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        const all = await getAllPlaceSpecs();
        const out: SpecsByPlace = {};
        for (const id of ids) if (all[id]) out[id] = all[id];
        return out;
      }
      console.error('Error fetching places specs:', error);
      throw error;
    }
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const spec = toPlaceSpec(row);
      if (spec) rows.push(spec);
    }
  }
  return groupSpecsByPlace(rows);
}

/** Specificities of one café. */
export async function getPlaceSpecs(placeId: string): Promise<PlaceSpec[]> {
  return fetchSpecs(placeId);
}

export function specMap(specs: PlaceSpec[]): PlaceSpecMap {
  const out: PlaceSpecMap = {};
  for (const s of specs) out[s.spec] = s;
  return out;
}

/** Specs the signed-in user already answered at this café. */
export async function getMySpecVotes(placeId: string): Promise<SpecId[]> {
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('place_spec_votes')
    .select('spec')
    .eq('place_id', placeId)
    .eq('user_id', user.id);
  if (error) {
    console.error('Error fetching my spec votes:', error);
    return [];
  }
  return ((data ?? []) as { spec: string }[])
    .map((r) => r.spec)
    .filter(isSpecId);
}

export type SpecVoteResult =
  | { ok: true; grainsAwarded: number; reason: 'ok' | 'already_voted' | 'daily_cap' }
  | { ok: false; error: string };

/** Yes / No on a specificity (needs a check-in at the café in the last 3 h). */
export async function voteSpec(
  placeId: string,
  spec: SpecId,
  vote: boolean
): Promise<SpecVoteResult> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.rpc('vote_place_spec', {
    p_place: placeId,
    p_spec: spec,
    p_vote: vote,
  });
  if (error) throw error;
  const row = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    grains_awarded?: number;
    reason?: 'ok' | 'already_voted' | 'daily_cap';
  };
  if (!row.ok) return { ok: false, error: row.error ?? 'unknown' };
  invalidateCache('specs:');
  return {
    ok: true,
    grainsAwarded: row.grains_awarded ?? 0,
    reason: row.reason ?? 'ok',
  };
}

/** Café team: declare a specificity (true / false), or remove it (null). */
export async function declareSpec(
  placeId: string,
  spec: SpecId,
  value: boolean | null
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.rpc('declare_place_spec', {
    p_place: placeId,
    p_spec: spec,
    p_value: value,
  });
  if (error) throw error;
  const row = (data ?? {}) as { ok?: boolean; error?: string };
  invalidateCache('specs:');
  return { ok: Boolean(row.ok), error: row.error };
}

/** Café team: what the café declared (readable by its team only). */
export async function getPlaceDeclarations(
  placeId: string
): Promise<Partial<Record<SpecId, boolean>>> {
  const out: Partial<Record<SpecId, boolean>> = {};
  if (!supabase) return out;
  const { data, error } = await supabase
    .from('place_spec_declarations')
    .select('spec, value')
    .eq('place_id', placeId);
  if (error) {
    console.error('Error fetching declarations:', error);
    return out;
  }
  for (const row of (data ?? []) as { spec: string; value: boolean }[]) {
    if (isSpecId(row.spec)) out[row.spec] = row.value;
  }
  return out;
}
