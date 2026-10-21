import { supabase } from '@/lib/supabase/client';

export type NotificationEventId =
  | 'global'
  | 'claim_review'
  | 'team_invite'
  | 'flash_drop'
  | 'validation';

export interface NotificationPreferenceRow {
  event: NotificationEventId;
  push: boolean;
  email: boolean;
  quietFrom: string | null;
  quietTo: string | null;
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
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('event, push, email, quiet_from, quiet_to')
    .order('event', { ascending: true });

  if (error) {
    console.error('notification_preferences list error:', error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeRow);
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
