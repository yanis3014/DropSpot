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

/** Replace weekly hours for a place (owner RLS). */
export async function replacePlaceOpeningHours(
  placeId: string,
  hours: DayHoursDraft[]
): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { error: delError } = await supabase
    .from('place_opening_hours')
    .delete()
    .eq('place_id', placeId);
  if (delError) {
    console.error('replacePlaceOpeningHours delete:', delError);
    throw delError;
  }

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

  if (inserts.length === 0) return;

  const { error: insError } = await supabase
    .from('place_opening_hours')
    .insert(inserts);
  if (insError) {
    console.error('replacePlaceOpeningHours insert:', insError);
    throw insError;
  }
}

/** Replace special hours for a place (owner RLS). */
export async function replacePlaceSpecialHours(
  placeId: string,
  specials: SpecialHoursDraft[]
): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { error: delError } = await supabase
    .from('place_special_hours')
    .delete()
    .eq('place_id', placeId);
  if (delError) {
    console.error('replacePlaceSpecialHours delete:', delError);
    throw delError;
  }

  if (specials.length === 0) return;

  const inserts = specials.map((s) =>
    s.closed
      ? {
          place_id: placeId,
          on_date: s.onDate,
          opens: null,
          closes: null,
          closed: true,
          label: s.label.trim() || null,
        }
      : {
          place_id: placeId,
          on_date: s.onDate,
          opens: normalizeTimeInput(s.opens ?? '09:00'),
          closes: normalizeTimeInput(s.closes ?? '18:00'),
          closed: false,
          label: s.label.trim() || null,
        }
  );

  const { error: insError } = await supabase
    .from('place_special_hours')
    .insert(inserts);
  if (insError) {
    console.error('replacePlaceSpecialHours insert:', insError);
    throw insError;
  }
}
