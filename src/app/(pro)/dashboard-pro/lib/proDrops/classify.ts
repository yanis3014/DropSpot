import type { FlashDrop } from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';

/** Section liste pro (En cours / Programmés / Terminés). */
export type DropListSection = 'live' | 'scheduled' | 'finished';

export type DropFinishedReason = 'ended' | 'stopped';

export function classifyFlashDrop(
  drop: Pick<FlashDrop, 'starts_at' | 'ends_at' | 'stopped_at'>,
  nowMs: number = Date.now()
): DropListSection {
  if (drop.stopped_at) return 'finished';

  const start = new Date(drop.starts_at).getTime();
  const end = new Date(drop.ends_at).getTime();

  if (Number.isFinite(end) && end <= nowMs) return 'finished';
  if (Number.isFinite(start) && start > nowMs) return 'scheduled';
  return 'live';
}

export function finishedDropReason(
  drop: Pick<FlashDrop, 'ends_at' | 'stopped_at'>,
  nowMs: number = Date.now()
): DropFinishedReason {
  if (drop.stopped_at) return 'stopped';
  const end = new Date(drop.ends_at).getTime();
  if (Number.isFinite(end) && end <= nowMs) return 'ended';
  return 'ended';
}

export function partitionFlashDrops(
  drops: FlashDrop[],
  nowMs: number = Date.now()
): {
  live: FlashDrop[];
  scheduled: FlashDrop[];
  finished: FlashDrop[];
} {
  const live: FlashDrop[] = [];
  const scheduled: FlashDrop[] = [];
  const finished: FlashDrop[] = [];

  for (const drop of drops) {
    const section = classifyFlashDrop(drop, nowMs);
    if (section === 'live') live.push(drop);
    else if (section === 'scheduled') scheduled.push(drop);
    else finished.push(drop);
  }

  live.sort(
    (a, b) =>
      new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime()
  );
  scheduled.sort(
    (a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  finished.sort(
    (a, b) =>
      new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime()
  );

  return { live, scheduled, finished };
}
