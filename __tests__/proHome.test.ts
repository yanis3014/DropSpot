import { describe, expect, it } from 'vitest';
import {
  buildChecklistTasks,
  countChecklistDone,
  CHECKLIST_TOTAL,
} from '@/app/(pro)/dashboard-pro/lib/proHome/checklist';
import {
  formatParisDateLong,
  formatParisTimeHHMM,
} from '@/app/(pro)/dashboard-pro/lib/proHome/parisTime';

describe('proHome checklist', () => {
  it('calcule 0 sur 4 quand rien n’est rempli', () => {
    const input = {
      hasCoverPhoto: false,
      hasOpeningHours: false,
      hasDescription: false,
      hasFirstDrop: false,
    };
    expect(countChecklistDone(input)).toBe(0);
    const tasks = buildChecklistTasks(input, {
      photo: '/a',
      hours: '/b',
      description: '/c',
      drop: '/d',
    });
    expect(tasks).toHaveLength(CHECKLIST_TOTAL);
    expect(tasks.every((t) => !t.done)).toBe(true);
  });

  it('compte les tâches cochées', () => {
    expect(
      countChecklistDone({
        hasCoverPhoto: true,
        hasOpeningHours: true,
        hasDescription: false,
        hasFirstDrop: true,
      })
    ).toBe(3);
  });
});

describe('proHome Paris time (DST 2026-10-25)', () => {
  it('formate HH:MM en Europe/Paris autour du changement d’heure', () => {
    // Dernier dimanche d’octobre 2026 : passage à l’heure d’hiver (03:00 → 02:00)
    const before = new Date('2026-10-25T00:30:00.000Z');
    const after = new Date('2026-10-25T02:30:00.000Z');

    expect(formatParisTimeHHMM(before)).toMatch(/^\d{2}:\d{2}$/);
    expect(formatParisTimeHHMM(after)).toMatch(/^\d{2}:\d{2}$/);

    const labelBefore = formatParisDateLong(before);
    const labelAfter = formatParisDateLong(after);
    expect(labelBefore.toLowerCase()).toContain('octobre');
    expect(labelAfter.toLowerCase()).toContain('octobre');
  });
});
