import { describe, expect, it } from 'vitest';
import {
  classifyFlashDrop,
  finishedDropReason,
  partitionFlashDrops,
} from '@/app/(pro)/dashboard-pro/lib/proDrops/classify';
import { finishedDropTagLabel } from '@/app/(pro)/dashboard-pro/lib/proDrops/display';
import type { FlashDrop } from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';

function drop(
  partial: Partial<FlashDrop> & Pick<FlashDrop, 'starts_at' | 'ends_at'>
): FlashDrop {
  return {
    id: 'd1',
    vendor_id: 'v1',
    place_id: 'p1',
    title: 'Test',
    is_active: true,
    ...partial,
  };
}

const NOW = new Date('2026-10-21T14:00:00.000Z').getTime();

describe('proDrops classify', () => {
  it('classe en cours quand la fenêtre couvre now sans arrêt', () => {
    const d = drop({
      starts_at: '2026-10-21T12:00:00.000Z',
      ends_at: '2026-10-21T18:00:00.000Z',
    });
    expect(classifyFlashDrop(d, NOW)).toBe('live');
  });

  it('classe programmé quand starts_at est dans le futur', () => {
    const d = drop({
      starts_at: '2026-10-25T16:00:00.000Z',
      ends_at: '2026-10-25T18:00:00.000Z',
    });
    expect(classifyFlashDrop(d, NOW)).toBe('scheduled');
  });

  it('classe terminé quand ends_at est passé', () => {
    const d = drop({
      starts_at: '2026-10-20T08:00:00.000Z',
      ends_at: '2026-10-20T10:00:00.000Z',
    });
    expect(classifyFlashDrop(d, NOW)).toBe('finished');
    expect(finishedDropReason(d, NOW)).toBe('ended');
    expect(finishedDropTagLabel(d, NOW)).toBe('Terminé');
  });

  it('classe arrêté quand stopped_at est renseigné', () => {
    const d = drop({
      starts_at: '2026-10-21T12:00:00.000Z',
      ends_at: '2026-10-21T18:00:00.000Z',
      stopped_at: '2026-10-21T13:00:00.000Z',
    });
    expect(classifyFlashDrop(d, NOW)).toBe('finished');
    expect(finishedDropReason(d, NOW)).toBe('stopped');
    expect(finishedDropTagLabel(d, NOW)).toBe('Arrêté');
  });

  it('partitionne live / programmé / terminé', () => {
    const rows = [
      drop({
        id: 'live',
        starts_at: '2026-10-21T12:00:00.000Z',
        ends_at: '2026-10-21T18:00:00.000Z',
      }),
      drop({
        id: 'sched',
        starts_at: '2026-10-25T16:00:00.000Z',
        ends_at: '2026-10-25T18:00:00.000Z',
      }),
      drop({
        id: 'done',
        starts_at: '2026-10-19T08:00:00.000Z',
        ends_at: '2026-10-19T10:00:00.000Z',
      }),
      drop({
        id: 'stopped',
        starts_at: '2026-10-21T12:00:00.000Z',
        ends_at: '2026-10-21T18:00:00.000Z',
        stopped_at: '2026-10-21T13:00:00.000Z',
      }),
    ];
    const parts = partitionFlashDrops(rows, NOW);
    expect(parts.live.map((d) => d.id)).toEqual(['live']);
    expect(parts.scheduled.map((d) => d.id)).toEqual(['sched']);
    expect(parts.finished.map((d) => d.id)).toEqual(['stopped', 'done']);
  });
});
