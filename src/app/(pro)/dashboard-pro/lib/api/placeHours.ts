import { supabase } from '@/lib/supabase/client';
import type {
  DayHoursDraft,
  HourSlot,
  SpecialHoursDraft,
  Weekday,
} from '@/app/(pro)/dashboard-pro/lib/etablissement/draft';
import { emptyWeekHours, normalizeTimeInput } from '@/app/(pro)/dashboard-pro/lib/etablissement/draft';

export type PlaceOpeningHourRow = {
  id: string;
  place_id: string;
  weekday: number;
  opens: string;
  closes: string;
};

export type PlaceSpecialHourRow = {
  id: string;
  place_id: string;
  on_date: string;
  opens: string | null;
  closes: string | null;
  closed: boolean;
  label: string | null;
};

function asTimeHHMM(raw: string): string {
  return normalizeTimeInput(String(raw).slice(0, 5));
}

export async function listPlaceOpeningHours(
  placeId: string
): Promise<PlaceOpeningHourRow[]> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase
    .from('place_opening_hours')
    .select('id, place_id, weekday, opens, closes')
    .eq('place_id', placeId)
    .order('weekday', { ascending: true })
    .order('opens', { ascending: true });

  if (error) {
    console.error('listPlaceOpeningHours:', error);
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    place_id: String(row.place_id),
    weekday: Number(row.weekday),
    opens: asTimeHHMM(String(row.opens)),
    closes: asTimeHHMM(String(row.closes)),
  }));
}

export async function listPlaceSpecialHours(
  placeId: string
): Promise<PlaceSpecialHourRow[]> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase
    .from('place_special_hours')
    .select('id, place_id, on_date, opens, closes, closed, label')
    .eq('place_id', placeId)
    .order('on_date', { ascending: true });

  if (error) {
    console.error('listPlaceSpecialHours:', error);
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    place_id: String(row.place_id),
    on_date: String(row.on_date).slice(0, 10),
    opens: row.opens != null ? asTimeHHMM(String(row.opens)) : null,
    closes: row.closes != null ? asTimeHHMM(String(row.closes)) : null,
    closed: Boolean(row.closed),
    label: typeof row.label === 'string' ? row.label : null,
  }));
}

export function openingHoursToDraft(
  rows: PlaceOpeningHourRow[]
): DayHoursDraft[] {
  const week = emptyWeekHours();
  const byDay = new Map<number, HourSlot[]>();
  for (const row of rows) {
    const list = byDay.get(row.weekday) ?? [];
    list.push({ opens: row.opens, closes: row.closes });
    byDay.set(row.weekday, list);
  }
  return week.map((day) => {
    const slots = byDay.get(day.weekday) ?? [];
    if (slots.length === 0) {
      return { ...day, closed: true, slots: [] };
    }
    return {
      weekday: day.weekday as Weekday,
      closed: false,
      slots: slots.slice(0, 2),
    };
  });
}

export function specialHoursToDraft(
  rows: PlaceSpecialHourRow[]
): SpecialHoursDraft[] {
  return rows.map((row) => ({
    key: row.id,
    onDate: row.on_date,
    label: row.label ?? '',
    closed: row.closed,
    opens: row.closed ? null : row.opens,
    closes: row.closed ? null : row.closes,
  }));
}

/** Ids of the current rows, so new rows are written before old ones go. */
async function listRowIds(
  table: 'place_opening_hours' | 'place_special_hours',
  placeId: string
): Promise<string[]> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('place_id', placeId);
  if (error) throw error;
  return ((data ?? []) as { id: string }[]).map((row) => String(row.id));
}

/**
 * Replace rows for a place (owner RLS): insert the new rows first, then
 * delete the previous ones, so a failed insert never leaves the café
 * without hours.
 */
async function replaceRows(
  table: 'place_opening_hours' | 'place_special_hours',
  placeId: string,
  inserts: Record<string, unknown>[]
): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const oldIds = await listRowIds(table, placeId);

  if (inserts.length > 0) {
    const { error: insError } = await supabase.from(table).insert(inserts);
    if (insError) {
      console.error(`${table} insert:`, insError);
      throw insError;
    }
  }

  if (oldIds.length > 0) {
    const { error: delError } = await supabase
      .from(table)
      .delete()
      .in('id', oldIds);
    if (delError) {
      console.error(`${table} delete:`, delError);
      throw delError;
    }
  }
}

/** Replace weekly hours for a place (owner RLS). */
export async function replacePlaceOpeningHours(
  placeId: string,
  hours: DayHoursDraft[]
): Promise<void> {
  const inserts: {
    place_id: string;
    weekday: number;
    opens: string;
    closes: string;
  }[] = [];

  for (const day of hours) {
    if (day.closed) continue;
    for (const slot of day.slots) {
      inserts.push({
        place_id: placeId,
        weekday: day.weekday,
        opens: normalizeTimeInput(slot.opens),
        closes: normalizeTimeInput(slot.closes),
      });
    }
  }

  await replaceRows('place_opening_hours', placeId, inserts);
}

/** Replace special hours for a place (owner RLS). */
export async function replacePlaceSpecialHours(
  placeId: string,
  specials: SpecialHoursDraft[]
): Promise<void> {
  // validateSpecial guarantees opens/closes when the day is not closed.
  const inserts = specials.map((s) => ({
    place_id: placeId,
    on_date: s.onDate,
    opens: s.closed || !s.opens ? null : normalizeTimeInput(s.opens),
    closes: s.closed || !s.closes ? null : normalizeTimeInput(s.closes),
    closed: s.closed,
    label: s.label.trim() || null,
  }));

  await replaceRows('place_special_hours', placeId, inserts);
}
