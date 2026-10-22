/** Aggregation helpers for `/specificites` (community endorsements). */

export const CONSENSUS_THRESHOLD = 3;

export type SpecStatus = 'confirmed' | 'pending';

export type SpecCategoryAgg = {
  category: string;
  voteCount: number;
  lastConfirmedAt: string;
  status: SpecStatus;
};

export function statusForVotes(voteCount: number): SpecStatus {
  return voteCount >= CONSENSUS_THRESHOLD ? 'confirmed' : 'pending';
}

export function filledPips(voteCount: number): number {
  return Math.min(Math.max(0, voteCount), CONSENSUS_THRESHOLD);
}

export function votesLabel(voteCount: number): string {
  if (voteCount >= CONSENSUS_THRESHOLD) {
    return `${voteCount} confirmation${voteCount > 1 ? 's' : ''}`;
  }
  return `${filledPips(voteCount)} sur ${CONSENSUS_THRESHOLD}`;
}

/** Aggregate raw endorsement rows by category (real DB categories only). */
export function aggregateEndorsementsByCategory(
  rows: { category: string; created_at: string }[]
): SpecCategoryAgg[] {
  const byCat = new Map<
    string,
    { count: number; lastAt: string }
  >();

  for (const row of rows) {
    const cat = row.category?.trim();
    if (!cat) continue;
    const prev = byCat.get(cat);
    if (!prev) {
      byCat.set(cat, { count: 1, lastAt: row.created_at });
      continue;
    }
    prev.count += 1;
    if (row.created_at > prev.lastAt) prev.lastAt = row.created_at;
  }

  return [...byCat.entries()]
    .map(([category, { count, lastAt }]) => ({
      category,
      voteCount: count,
      lastConfirmedAt: lastAt,
      status: statusForVotes(count),
    }))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'confirmed' ? -1 : 1;
      }
      return b.voteCount - a.voteCount;
    });
}

/** « Dernière confirmation il y a … » (Europe/Paris relative). */
export function formatLastConfirmationHint(
  iso: string,
  now: Date = new Date()
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Dernière confirmation récente';

  const diffMs = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Dernière confirmation à l’instant';
  if (minutes < 60) {
    return `Dernière confirmation il y a ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Dernière confirmation il y a ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dernière confirmation hier';
  if (days < 30) {
    return `Dernière confirmation il y a ${days} jours`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `Dernière confirmation il y a ${months} mois`;
  }
  return 'Dernière confirmation il y a plus d’un an';
}
