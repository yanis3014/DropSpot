/** Helpers for `/specificites` (the café pulse seen by the café team). */
import type { PlaceSpec, SpecStatus } from '@/lib/specs';

/** Yes votes needed to confirm (same threshold as get_place_specs()). */
export const CONSENSUS_THRESHOLD = 3;

export type ProSpecRowStatus = 'confirmed' | 'pending' | 'contested';

/** Status shown on the pro screen (« Annoncé » and « À vérifier » wait for votes). */
export function proRowStatus(status: SpecStatus): ProSpecRowStatus {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'disputed') return 'contested';
  return 'pending';
}

export function filledPips(voteCount: number): number {
  return Math.min(Math.max(0, voteCount), CONSENSUS_THRESHOLD);
}

/** « 4 oui · 1 non », « Aucun vote ». */
export function votesLabel(spec: Pick<PlaceSpec, 'yes_votes' | 'no_votes'>): string {
  if (spec.yes_votes + spec.no_votes === 0) return 'Aucun vote';
  return `${spec.yes_votes} oui · ${spec.no_votes} non`;
}

/** « Dernier vote il y a … » (Europe/Paris relative). */
export function formatLastConfirmationHint(
  iso: string,
  now: Date = new Date()
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Dernier vote récente';

  const diffMs = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Dernier vote à l’instant';
  if (minutes < 60) {
    return `Dernier vote il y a ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Dernier vote il y a ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dernier vote hier';
  if (days < 30) {
    return `Dernier vote il y a ${days} jours`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `Dernier vote il y a ${months} mois`;
  }
  return 'Dernier vote il y a plus d’un an';
}
