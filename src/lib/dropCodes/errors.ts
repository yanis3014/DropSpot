import type { Drop } from '@/lib/api/drops';

const CLAIM_ERROR_FR: Record<string, string> = {
  not_authenticated: 'Tu dois être connecté pour obtenir un code.',
  drop_not_found: 'Ce drop est introuvable.',
  place_not_verified: 'Ce café n’est pas encore vérifié.',
  sold_out: 'Plus de places pour ce drop.',
  drop_ended: 'Ce drop est terminé.',
  drop_stopped: 'Ce drop a été arrêté par le café.',
  drop_not_live: 'Ce drop n’est plus disponible.',
};

/**
 * French message for claim_drop errors.
 * For `drop_not_live`, refine using the drop times when available.
 */
export function claimDropErrorMessage(
  code: string | null | undefined,
  drop?: Pick<Drop, 'start_time' | 'end_time'> | null,
  now: number = Date.now()
): string {
  if (!code) return 'Impossible d’obtenir un code. Réessaie.';
  if (code === 'drop_not_live' && drop) {
    const end = new Date(drop.end_time).getTime();
    const start = new Date(drop.start_time).getTime();
    if (Number.isFinite(end) && end <= now) {
      return CLAIM_ERROR_FR.drop_ended;
    }
    if (Number.isFinite(start) && start > now) {
      return 'Ce drop n’a pas encore commencé.';
    }
    return CLAIM_ERROR_FR.drop_stopped;
  }
  return CLAIM_ERROR_FR[code] ?? 'Impossible d’obtenir un code. Réessaie.';
}
