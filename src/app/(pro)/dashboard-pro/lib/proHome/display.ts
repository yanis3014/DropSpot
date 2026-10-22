import type { FlashDrop } from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';
import { formatParisTimeHHMM } from '@/app/(pro)/dashboard-pro/lib/proHome/parisTime';

export function flashDropStockLabel(drop: FlashDrop): string {
  if (drop.kind === 'activity') {
    const going = drop.participants ?? 0;
    const label = `${going} inscrit${going === 1 ? '' : 's'}`;
    return drop.max_uses != null
      ? `${label} sur ${drop.max_uses} places`
      : `${label} · sans limite`;
  }
  const used = drop.current_uses ?? 0;
  if (drop.max_uses != null) {
    return `${used} utilisé${used === 1 ? '' : 's'} sur ${drop.max_uses}`;
  }
  return `${used} utilisé${used === 1 ? '' : 's'} · sans limite`;
}

export function flashDropProgress(drop: FlashDrop): number | undefined {
  if (drop.max_uses == null || drop.max_uses <= 0) return undefined;
  const used =
    drop.kind === 'activity' ? (drop.participants ?? 0) : (drop.current_uses ?? 0);
  return Math.min(1, used / drop.max_uses);
}

export function flashDropEndLabel(drop: FlashDrop): string {
  return `fin à ${formatParisTimeHHMM(drop.ends_at)}`;
}

export function validatorDisplayName(
  validator: string,
  actorName: string | null | undefined
): string {
  const v = validator.trim();
  if (!v) return '—';
  if (!actorName?.trim()) return v;
  const actor = actorName.trim();
  if (v.toLowerCase() === actor.toLowerCase()) return 'toi';
  const actorFirst = actor.split(/\s+/)[0]?.toLowerCase();
  if (actorFirst && v.toLowerCase() === actorFirst) return 'toi';
  return v.split(/\s+/)[0] ?? v;
}
