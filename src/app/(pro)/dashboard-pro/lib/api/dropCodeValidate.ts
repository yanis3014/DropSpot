import { supabase } from '@/lib/supabase/client';
import type { RedeemDropCodeResult } from '@/app/(pro)/dashboard-pro/lib/counterValidate/verdict';
import { normalizeDropCodeRaw } from '@/app/(pro)/dashboard-pro/lib/counterValidate/formatCode';

export type PlaceMemberRole = 'owner' | 'manager' | 'staff';

export async function getPlaceMemberRole(
  placeId: string
): Promise<PlaceMemberRole | null> {
  if (!supabase || !placeId) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('place_members')
    .select('role')
    .eq('place_id', placeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data?.role) return null;
  const role = String(data.role);
  if (role === 'owner' || role === 'manager' || role === 'staff') {
    return role;
  }
  return null;
}

export async function redeemDropCode(
  placeId: string,
  rawCode: string
): Promise<{ result: RedeemDropCodeResult; networkError: boolean }> {
  if (!supabase) {
    return {
      result: { ok: false, status: 'not_authenticated' },
      networkError: true,
    };
  }

  const code = normalizeDropCodeRaw(rawCode);
  if (code.length !== 6) {
    return { result: { ok: false, status: 'not_found' }, networkError: false };
  }

  try {
    const { data, error } = await supabase.rpc('redeem_drop_code', {
      p_place: placeId,
      p_code: code,
    });

    if (error) {
      const offline =
        error.message?.toLowerCase().includes('fetch') ||
        error.message?.toLowerCase().includes('network') ||
        !navigator.onLine;
      return {
        result: { ok: false, status: offline ? 'offline' : 'not_found' },
        networkError: offline,
      };
    }

    return {
      result: (data ?? { ok: false, status: 'not_found' }) as RedeemDropCodeResult,
      networkError: false,
    };
  } catch {
    return {
      result: { ok: false, status: 'offline' },
      networkError: true,
    };
  }
}

export async function cancelDropRedemption(
  placeId: string,
  rawCode: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'no_client' };
  const code = normalizeDropCodeRaw(rawCode);
  const { data, error } = await supabase.rpc('cancel_redemption', {
    p_place: placeId,
    p_code: code,
  });
  if (error) return { ok: false, error: error.message };
  const row = data as { ok?: boolean; error?: string } | null;
  return { ok: Boolean(row?.ok), error: row?.error };
}

export async function addDropPlaces(
  flashDropId: string,
  n: number
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'no_client' };
  const { data, error } = await supabase.rpc('add_drop_places', {
    p_drop: flashDropId,
    p_n: n,
  });
  if (error) return { ok: false, error: error.message };
  const row = data as { ok?: boolean; error?: string } | null;
  return { ok: Boolean(row?.ok), error: row?.error };
}

export interface DropCodeContext {
  dropTitle: string | null;
  maxUses: number | null;
  currentUses: number | null;
  endsAt: string | null;
  stoppedAt: string | null;
  flashDropId: string | null;
}

/** Enrich verdict from real rows (no invented fields). */
export async function fetchDropContextByCode(
  placeId: string,
  rawCode: string
): Promise<DropCodeContext | null> {
  if (!supabase) return null;
  const norm = normalizeDropCodeRaw(rawCode);
  if (norm.length !== 6) return null;

  const { data, error } = await supabase
    .from('drop_codes')
    .select(
      'flash_drop_id, flash_drops(title, max_uses, current_uses, ends_at, stopped_at, place_id)'
    )
    .eq('code', norm)
    .maybeSingle();

  if (error || !data) return null;

  const fd = data.flash_drops as
    | {
        title?: string;
        max_uses?: number | null;
        current_uses?: number | null;
        ends_at?: string;
        stopped_at?: string | null;
        place_id?: string;
      }
    | null
    | undefined;

  if (!fd || fd.place_id !== placeId) return null;

  return {
    dropTitle: fd.title ?? null,
    maxUses: fd.max_uses ?? null,
    currentUses: fd.current_uses ?? null,
    endsAt: fd.ends_at ?? null,
    stoppedAt: fd.stopped_at ?? null,
    flashDropId: data.flash_drop_id as string,
  };
}

export async function fetchFlashDropRemaining(
  flashDropId: string
): Promise<{ title: string | null; remaining: number | null }> {
  if (!supabase) return { title: null, remaining: null };
  const { data } = await supabase
    .from('flash_drops')
    .select('title, max_uses, current_uses')
    .eq('id', flashDropId)
    .maybeSingle();
  if (!data) return { title: null, remaining: null };
  const max = data.max_uses as number | null;
  const cur = (data.current_uses as number) ?? 0;
  const remaining =
    max != null ? Math.max(0, max - cur) : null;
  return { title: (data.title as string) ?? null, remaining };
}
