import { supabase } from '@/lib/supabase/client';

/** Preference events for the pro settings screen (snake_case). */
export type NotificationEventId =
  | 'global'
  | 'drop_ending_soon'
  | 'drop_sold_out'
  | 'info_reported'
  | 'info_status_changed'
  | 'verification_progress'
  | 'daily_summary';

export type NotifiableEventId = Exclude<NotificationEventId, 'global'>;

export interface NotificationPreferenceRow {
  event: NotificationEventId;
  push: boolean;
  email: boolean;
  quietFrom: string | null;
  quietTo: string | null;
}

export type NotificationEventMeta = {
  event: NotifiableEventId;
  label: string;
  note: string;
  defaultPush: boolean;
  defaultEmail: boolean;
};

/** Maquette defaults — source of truth for Vitest + UI. */
export const NOTIFICATION_EVENT_DEFAULTS: NotificationEventMeta[] = [
  {
    event: 'drop_ending_soon',
    label: 'Un drop se termine bientôt',
    note: '15 min avant la fin',
    defaultPush: true,
    defaultEmail: false,
  },
  {
    event: 'drop_sold_out',
    label: 'Un drop est épuisé',
    note: 'Toutes les places sont utilisées',
    defaultPush: true,
    defaultEmail: false,
  },
  {
    event: 'info_reported',
    label: 'Un client signale une info',
    note: 'Wi-Fi, horaires, spécificités',
    defaultPush: true,
    defaultEmail: true,
  },
  {
    event: 'info_status_changed',
    label: 'Une info est confirmée ou retirée',
    note: 'Par la communauté',
    defaultPush: false,
    defaultEmail: true,
  },
  {
    event: 'verification_progress',
    label: 'Ta vérification avance',
    note: 'Revendication d’un café',
    defaultPush: true,
    defaultEmail: true,
  },
  {
    event: 'daily_summary',
    label: 'Résumé du jour',
    note: 'Chaque soir à 20:00',
    defaultPush: false,
    defaultEmail: true,
  },
];

export const DEFAULT_QUIET_FROM = '22:00';
export const DEFAULT_QUIET_TO = '07:00';

export function defaultPreferenceRows(): NotificationPreferenceRow[] {
  return [
    {
      event: 'global',
      push: true,
      email: false,
      quietFrom: DEFAULT_QUIET_FROM,
      quietTo: DEFAULT_QUIET_TO,
    },
    ...NOTIFICATION_EVENT_DEFAULTS.map((meta) => ({
      event: meta.event as NotificationEventId,
      push: meta.defaultPush,
      email: meta.defaultEmail,
      quietFrom: null,
      quietTo: null,
    })),
  ];
}

/** Merge DB rows with defaults so every maquette line is present. */
export function mergePreferenceDefaults(
  rows: NotificationPreferenceRow[]
): NotificationPreferenceRow[] {
  const byEvent = new Map(rows.map((r) => [r.event, r]));
  return defaultPreferenceRows().map((fallback) => {
    const existing = byEvent.get(fallback.event);
    if (!existing) return fallback;
    if (fallback.event === 'global') {
      // Keep null quiet hours when the user disabled silence.
      return {
        ...fallback,
        push: existing.push,
        email: existing.email,
        quietFrom: existing.quietFrom,
        quietTo: existing.quietTo,
      };
    }
    return {
      ...fallback,
      push: existing.push,
      email: existing.email,
    };
  });
}

function normalizeRow(row: Record<string, unknown>): NotificationPreferenceRow {
  return {
    event: String(row.event) as NotificationEventId,
    push: Boolean(row.push),
    email: Boolean(row.email),
    quietFrom:
      typeof row.quiet_from === 'string' ? row.quiet_from.slice(0, 5) : null,
    quietTo:
      typeof row.quiet_to === 'string' ? row.quiet_to.slice(0, 5) : null,
  };
}

export async function listMyNotificationPreferences(): Promise<
  NotificationPreferenceRow[]
> {
  if (!supabase) return defaultPreferenceRows();

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('event, push, email, quiet_from, quiet_to')
    .order('event', { ascending: true });

  if (error) {
    console.error('notification_preferences list error:', error);
    return defaultPreferenceRows();
  }

  return mergePreferenceDefaults(
    ((data ?? []) as Record<string, unknown>[]).map(normalizeRow)
  );
}

export async function upsertNotificationPreference(
  input: NotificationPreferenceRow
): Promise<boolean> {
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const payload: Record<string, unknown> = {
    user_id: user.id,
    event: input.event,
    push: input.push,
    email: input.email,
    updated_at: new Date().toISOString(),
  };

  if (input.event === 'global') {
    payload.quiet_from = input.quietFrom;
    payload.quiet_to = input.quietTo;
  } else {
    payload.quiet_from = null;
    payload.quiet_to = null;
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id,event' });

  if (error) {
    console.error('notification_preferences upsert error:', error);
    return false;
  }

  return true;
}
