import { supabase } from '@/lib/supabase/client';

export type PlaceEventKind = 'view' | 'directions';
export type PlaceEventSource = 'map' | 'list' | 'top' | 'drop' | 'direct';

const VALID_SOURCES = new Set<PlaceEventSource>([
  'map',
  'list',
  'top',
  'drop',
  'direct',
]);

/** Maps `?from=` query values to a tracked source; anything else → direct. */
export function placeEventSourceFromParam(
  raw: string | null | undefined
): PlaceEventSource {
  if (!raw) return 'direct';
  return VALID_SOURCES.has(raw as PlaceEventSource)
    ? (raw as PlaceEventSource)
    : 'direct';
}

/**
 * Fire-and-forget place view / directions ping.
 *
 * Only signed-in visitors are counted: the server takes the visitor from the
 * session, so the numbers cafés see cannot be inflated with made-up visitor
 * ids. Never throws to the UI; skips silently without a session.
 */
export function logPlaceEvent(
  placeId: string,
  kind: PlaceEventKind,
  source?: PlaceEventSource
): void {
  if (!supabase || !placeId) return;

  void (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      await supabase.rpc('log_place_event', {
        p_place: placeId,
        p_kind: kind,
        p_source: source ?? null,
      });
    } catch {
      // Fire and forget: never block the place sheet.
    }
  })();
}
