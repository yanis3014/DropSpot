import { supabase } from '@/lib/supabase/client';
import type { DropTypeId } from '@/lib/filters';
import { cachedQuery, invalidateCache } from '@/lib/cache/clientCache';
export type { DropTypeId };

/** An event organised by the café (run, DJ set, workshop…) or an offer. */
export type DropFamily = 'event' | 'offer';

export type EventCategory =
  | 'sport'
  | 'music'
  | 'workshop'
  | 'meetup'
  | 'tasting'
  | 'other';

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  sport: 'Sport',
  music: 'Musique',
  workshop: 'Atelier',
  meetup: 'Rencontre',
  tasting: 'Dégustation',
  other: 'Événement',
};

export const EVENT_CATEGORIES = Object.keys(
  EVENT_CATEGORY_LABELS
) as EventCategory[];

export interface Drop {
  id: string;
  title: string;
  description?: string;
  family: DropFamily;
  /** Events only; `other` when the café did not pick one. */
  event_category?: EventCategory;
  /** Coarse type used by preferences and onboarding (promo | sport | event). */
  drop_type: DropTypeId;
  /** flash_drops.kind (discount | offer | special_price | activity). */
  raw_drop_type?: string | null;
  start_time: string;
  end_time: string;
  place_id: string;
  places?: {
    name: string;
    image_url?: string;
    address?: string;
    city?: string;
    category?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  /** Places for an event, or quantity for an offer (flash_drops.max_uses). */
  capacity?: number;
  /** Codes used for an offer (flash_drops.current_uses). */
  current_participants?: number;
  conditions?: string | null;
  created_at?: string;
  /** Stopped or deactivated by the café (only on a drop read by id). */
  stopped?: boolean;
  source?: 'flash_drops';
}

const DROP_SELECT =
  'id, place_id, title, description, starts_at, ends_at, is_active, stopped_at, kind, event_category, conditions, max_uses, current_uses, created_at, places(name, image_url, address, city, category, lat, lng)';

function asEventCategory(value: unknown): EventCategory {
  return typeof value === 'string' && value in EVENT_CATEGORY_LABELS
    ? (value as EventCategory)
    : 'other';
}

/** Maps a flash_drops row to the client Drop. */
export function rowToDrop(row: Record<string, unknown>): Drop {
  const kind = typeof row.kind === 'string' ? row.kind : 'offer';
  const family: DropFamily = kind === 'activity' ? 'event' : 'offer';
  const category = family === 'event' ? asEventCategory(row.event_category) : undefined;
  const placesRaw = Array.isArray(row.places) ? row.places[0] : row.places;
  let places: Drop['places'];
  if (placesRaw && typeof placesRaw === 'object') {
    const p = placesRaw as Record<string, unknown>;
    places = {
      name: String(p.name ?? 'Café'),
      image_url: (p.image_url as string | undefined) ?? undefined,
      address: (p.address as string | undefined) ?? undefined,
      city: (p.city as string | undefined) ?? undefined,
      category: typeof p.category === 'string' ? p.category : null,
      lat: typeof p.lat === 'number' ? p.lat : null,
      lng: typeof p.lng === 'number' ? p.lng : null,
    };
  }
  return {
    id: String(row.id),
    title: String(row.title ?? 'Drop'),
    description: (row.description as string | null | undefined) ?? undefined,
    family,
    event_category: category,
    drop_type: family === 'offer' ? 'promo' : category === 'sport' ? 'sport' : 'event',
    raw_drop_type: kind,
    start_time: String(row.starts_at ?? ''),
    end_time: String(row.ends_at ?? ''),
    place_id: String(row.place_id ?? ''),
    places,
    capacity: typeof row.max_uses === 'number' ? row.max_uses : undefined,
    current_participants:
      typeof row.current_uses === 'number' ? row.current_uses : undefined,
    conditions: (row.conditions as string | null | undefined) ?? null,
    created_at: (row.created_at as string | undefined) ?? undefined,
    stopped: row.stopped_at != null || row.is_active === false,
    source: 'flash_drops',
  };
}

async function fetchDrops(options: {
  placeId?: string;
  limit?: number;
}): Promise<Drop[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }
  let query = supabase
    .from('flash_drops')
    .select(DROP_SELECT)
    .eq('is_active', true)
    .is('stopped_at', null)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (options.placeId) query = query.eq('place_id', options.placeId);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching drops:', error);
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[]).map(rowToDrop);
}

/** Live and upcoming drops (not ended, not stopped), soonest first. */
export async function getActiveDrops(): Promise<Drop[]> {
  return cachedQuery('drops:active', () => fetchDrops({}));
}

/** Same feed as getActiveDrops, for the Drops tab. */
export const getExploreDrops = getActiveDrops;

/** Next drops of one café, soonest first. */
export async function getPlaceDrops(placeId: string, limit = 3): Promise<Drop[]> {
  return fetchDrops({ placeId, limit });
}

/** One drop by id (also ended ones, for a shared link). */
export async function getDropById(id: string): Promise<Drop | null> {
  if (!supabase || !id) return null;
  const { data, error } = await supabase
    .from('flash_drops')
    .select(DROP_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('Error fetching drop:', error);
    throw error;
  }
  return data ? rowToDrop(data as Record<string, unknown>) : null;
}

/** Number of participants per event (drop_participants RPC, no user ids). */
export async function getParticipantCounts(
  dropIds: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!supabase || dropIds.length === 0) return out;
  const { data, error } = await supabase.rpc('drop_participants', {
    p_drops: dropIds,
  });
  if (error) {
    console.error('Error fetching participants:', error);
    return out;
  }
  for (const row of (data ?? []) as { flash_drop_id: string; participants: number }[]) {
    out[row.flash_drop_id] = row.participants;
  }
  return out;
}

/** Ids of the events the signed-in user joined. */
export async function getMyParticipationIds(): Promise<string[]> {
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('drop_participations')
    .select('flash_drop_id')
    .eq('user_id', user.id);
  if (error) {
    console.error('Error fetching participations:', error);
    return [];
  }
  return ((data ?? []) as { flash_drop_id: string }[]).map((r) => r.flash_drop_id);
}

/** Upcoming events the signed-in user joined, soonest first. */
export async function getMyUpcomingEvents(): Promise<Drop[]> {
  const ids = await getMyParticipationIds();
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase
    .from('flash_drops')
    .select(DROP_SELECT)
    .in('id', ids)
    .is('stopped_at', null)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) {
    console.error('Error fetching my events:', error);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(rowToDrop);
}

export type ParticipationResult =
  | { ok: true; joined: boolean; participants: number }
  | { ok: false; error: string };

async function callParticipation(
  fn: 'join_drop' | 'leave_drop',
  dropId: string
): Promise<ParticipationResult> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.rpc(fn, { p_drop: dropId });
  if (error) throw error;
  const row = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    joined?: boolean;
    participants?: number;
  };
  if (!row.ok) return { ok: false, error: row.error ?? 'not_found' };
  invalidateCache('drops:');
  return {
    ok: true,
    joined: Boolean(row.joined),
    participants: row.participants ?? 0,
  };
}

/** « Je participe » (places checked by the server). */
export function joinDrop(dropId: string): Promise<ParticipationResult> {
  return callParticipation('join_drop', dropId);
}

export function leaveDrop(dropId: string): Promise<ParticipationResult> {
  return callParticipation('leave_drop', dropId);
}

export function participationErrorMessage(code: string): string {
  switch (code) {
    case 'full':
      return 'C’est complet.';
    case 'ended':
      return 'Cet événement est terminé.';
    case 'not_authenticated':
      return 'Connecte-toi pour participer.';
    default:
      return 'Impossible de t’inscrire. Réessaie.';
  }
}

/** Feed sections, in display order. */
export type DropMoment = 'now' | 'today' | 'weekend' | 'later';

export const DROP_MOMENT_LABELS: Record<DropMoment, string> = {
  now: 'En ce moment',
  today: 'Aujourd’hui',
  weekend: 'Ce week-end',
  later: 'Plus tard',
};

/** Which feed section a drop belongs to, in the user's time zone. */
export function dropMoment(drop: Drop, now: number = Date.now()): DropMoment {
  const start = new Date(drop.start_time);
  if (start.getTime() <= now) return 'now';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const days = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  // Days until the end of this week's Sunday (getDay: 0 = Sunday).
  const daysToSunday = (7 - today.getDay()) % 7;
  const dow = start.getDay();
  if (days <= daysToSunday && (dow === 6 || dow === 0)) return 'weekend';
  return 'later';
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Google Calendar link to add an event (works on every phone). */
export function googleCalendarUrl(drop: Drop): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: drop.title,
    dates: `${icsDate(drop.start_time)}/${icsDate(drop.end_time)}`,
    details: drop.description ?? '',
    location: [drop.places?.name, drop.places?.address, drop.places?.city]
      .filter(Boolean)
      .join(', '),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** .ics file content for Apple Calendar. */
export function buildIcs(drop: Drop): string {
  const esc = (v: string) => v.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dropspot//FR',
    'BEGIN:VEVENT',
    `UID:${drop.id}@dropspot`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(drop.start_time)}`,
    `DTEND:${icsDate(drop.end_time)}`,
    `SUMMARY:${esc(drop.title)}`,
    `LOCATION:${esc([drop.places?.name, drop.places?.address, drop.places?.city].filter(Boolean).join(', '))}`,
    drop.description ? `DESCRIPTION:${esc(drop.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export type DropTiming = 'live' | 'upcoming' | 'ended';

export function getDropTiming(drop: Drop, now: number = Date.now()): DropTiming {
  const start = new Date(drop.start_time).getTime();
  const end = new Date(drop.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'ended';
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'ended';
}

function hourLabel(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Start of an upcoming drop in the user's time zone:
 * « Aujourd'hui · 18 h 30 », « Demain · 9 h », « Sam. 26 oct. · 9 h ».
 */
export function formatStartLabel(isoString: string, now: number = Date.now()): string {
  const start = new Date(isoString);
  if (!Number.isFinite(start.getTime())) return '';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const days = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return `Aujourd'hui · ${hourLabel(start)}`;
  if (days === 1) return `Demain · ${hourLabel(start)}`;
  const day = start.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${hourLabel(start)}`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isDropLive(drop: Drop): boolean {
  const now = Date.now();
  const start = new Date(drop.start_time).getTime();
  const end = new Date(drop.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return start <= now && now <= end;
}

export function formatCountdown(endTime: string, now: number = Date.now()): string {
  const end = new Date(endTime).getTime();
  const diff = end - now;

  if (!Number.isFinite(end) || diff <= 0) return '00:00:00';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
