import { describe, expect, it } from 'vitest';
import {
  aggregateEndorsementsByCategory,
  CONSENSUS_THRESHOLD,
  filledPips,
  formatLastConfirmationHint,
  statusForVotes,
  votesLabel,
} from '@/app/(pro)/dashboard-pro/lib/specificites/aggregate';
import { canAccessProPath, filterProNavHref } from '@/lib/pro/navAccess';

describe('specificites aggregate', () => {
  it('confirme à partir de CONSENSUS_THRESHOLD votes', () => {
    expect(CONSENSUS_THRESHOLD).toBe(3);
    expect(statusForVotes(2)).toBe('pending');
    expect(statusForVotes(3)).toBe('confirmed');
    expect(filledPips(5)).toBe(3);
    expect(votesLabel(2)).toBe('2 sur 3');
    expect(votesLabel(5)).toBe('5 confirmations');
  });

  it('agrège par catégorie réelle', () => {
    const rows = aggregateEndorsementsByCategory([
      { category: 'wifi', created_at: '2026-10-20T10:00:00.000Z' },
      { category: 'wifi', created_at: '2026-10-21T10:00:00.000Z' },
      { category: 'wifi', created_at: '2026-10-22T10:00:00.000Z' },
      { category: 'coffee', created_at: '2026-10-22T08:00:00.000Z' },
    ]);
    expect(rows).toHaveLength(2);
    const wifi = rows.find((r) => r.category === 'wifi');
    expect(wifi?.voteCount).toBe(3);
    expect(wifi?.status).toBe('confirmed');
    expect(wifi?.lastConfirmedAt).toBe('2026-10-22T10:00:00.000Z');
    const coffee = rows.find((r) => r.category === 'coffee');
    expect(coffee?.status).toBe('pending');
  });

  it('formate la dernière confirmation', () => {
    const now = new Date('2026-10-22T12:00:00.000Z');
    expect(
      formatLastConfirmationHint('2026-10-22T10:00:00.000Z', now)
    ).toMatch(/il y a 2 h/);
  });
});

describe('navAccess specificites', () => {
  it('autorise tous les rôles en lecture', () => {
    expect(canAccessProPath('/specificites', 'owner')).toBe(true);
    expect(canAccessProPath('/specificites', 'manager')).toBe(true);
    expect(canAccessProPath('/specificites', 'staff')).toBe(true);
    expect(filterProNavHref('/specificites', 'staff')).toBe(true);
    expect(filterProNavHref('/specificites', 'manager')).toBe(true);
  });
});
