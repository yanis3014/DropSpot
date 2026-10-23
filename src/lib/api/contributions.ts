import { supabase } from '@/lib/supabase/client';

export type ContributionKind =
  | 'welcome'
  | 'check_in'
  | 'spec_vote'
  | 'event_presence'
  | 'place_suggested'
  | 'flash_drop'
  | 'other';

export type ContributionItem = {
  id: string;
  kind: ContributionKind;
  title: string;
  placeName: string;
  createdAt: string;
  /** Grains credited (negative for a reversal). */
  gain: number;
};

const TITLES: Record<ContributionKind, string> = {
  welcome: 'Bienvenue sur Dropspot',
  check_in: 'Je suis ici',
  spec_vote: 'Info confirmée sur place',
  event_presence: 'Présent à un événement',
  place_suggested: 'Ton café a rejoint Dropspot',
  flash_drop: 'Code utilisé',
  other: 'Ajustement',
};

const KNOWN = new Set<string>(Object.keys(TITLES));

type LedgerRow = {
  id: string;
  amount: number;
  reason: string;
  ref_id: string | null;
  created_at: string;
};

async function placeNamesById(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!supabase || ids.length === 0) return out;
  const { data } = await supabase.from('places').select('id, name').in('id', ids);
  for (const row of (data ?? []) as { id: string; name: string | null }[]) {
    out[row.id] = row.name?.trim() || 'Café';
  }
  return out;
}

/**
 * What earned Grains, from the ledger (grains_transactions, own rows only),
 * with the café of each line.
 */
export async function getMyContributions(limit = 20): Promise<ContributionItem[]> {
  try {
    if (!supabase) return [];
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('grains_transactions')
      .select('id, amount, reason, ref_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Error fetching contributions:', error);
      return [];
    }
    const rows = (data ?? []) as LedgerRow[];

    // ref_id points to a check-in, a café, an event or a drop code.
    const refs = (reason: string) =>
      rows.filter((r) => r.reason === reason && r.ref_id).map((r) => r.ref_id as string);
    const [checkIns, events, codes] = await Promise.all([
      refs('check_in').length
        ? supabase.from('check_ins').select('id, place_id').in('id', refs('check_in'))
        : Promise.resolve({ data: [] }),
      refs('event_presence').length
        ? supabase.from('flash_drops').select('id, place_id').in('id', refs('event_presence'))
        : Promise.resolve({ data: [] }),
      refs('flash_drop').length
        ? supabase
            .from('drop_codes')
            .select('id, flash_drops(place_id)')
            .in('id', refs('flash_drop'))
        : Promise.resolve({ data: [] }),
    ]);

    const placeOfRef: Record<string, string> = {};
    for (const r of (checkIns.data ?? []) as { id: string; place_id: string }[]) {
      placeOfRef[r.id] = r.place_id;
    }
    for (const r of (events.data ?? []) as { id: string; place_id: string }[]) {
      placeOfRef[r.id] = r.place_id;
    }
    for (const r of (codes.data ?? []) as {
      id: string;
      flash_drops: { place_id: string } | { place_id: string }[] | null;
    }[]) {
      const fd = Array.isArray(r.flash_drops) ? r.flash_drops[0] : r.flash_drops;
      if (fd) placeOfRef[r.id] = fd.place_id;
    }
    for (const r of rows) {
      if ((r.reason === 'spec_vote' || r.reason === 'place_suggested') && r.ref_id) {
        placeOfRef[r.ref_id] = r.ref_id;
      }
    }

    const names = await placeNamesById([...new Set(Object.values(placeOfRef))]);

    return rows.map((r) => {
      const kind = (KNOWN.has(r.reason) ? r.reason : 'other') as ContributionKind;
      const placeId = r.ref_id ? placeOfRef[r.ref_id] : undefined;
      return {
        id: r.id,
        kind,
        title: r.amount < 0 ? 'Grains repris' : TITLES[kind],
        placeName: placeId ? (names[placeId] ?? 'Café') : 'Dropspot',
        createdAt: r.created_at,
        gain: r.amount,
      };
    });
  } catch (error) {
    console.error('Error in getMyContributions:', error);
    return [];
  }
}
