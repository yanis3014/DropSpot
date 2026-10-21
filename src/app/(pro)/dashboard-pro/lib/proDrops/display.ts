import type {
  FlashDrop,
  FlashDropKind,
} from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';
import { formatParisTimeHHMM } from '@/app/(pro)/dashboard-pro/lib/proHome/parisTime';
import { finishedDropReason } from '@/app/(pro)/dashboard-pro/lib/proDrops/classify';

const PARIS = 'Europe/Paris';

const KIND_LABEL: Record<FlashDropKind, string> = {
  discount: 'Réduction',
  offer: 'Offre',
  special_price: 'Prix spécial',
  activity: 'Activité',
};

/** Sous-titre « Réduction · sur place uniquement » depuis kind + conditions. */
export function flashDropTypeSubtitle(drop: FlashDrop): string {
  const kind = drop.kind ?? 'offer';
  const head = KIND_LABEL[kind] ?? 'Offre';
  if (kind === 'activity' && drop.max_uses != null) {
    return `${head} · ${drop.max_uses} place${drop.max_uses === 1 ? '' : 's'}`;
  }
  const cond = drop.conditions?.trim();
  return cond ? `${head} · ${cond}` : head;
}

export function finishedDropTagLabel(
  drop: Pick<FlashDrop, 'ends_at' | 'stopped_at'>,
  nowMs: number = Date.now()
): 'Terminé' | 'Arrêté' {
  return finishedDropReason(drop, nowMs) === 'stopped' ? 'Arrêté' : 'Terminé';
}

/** Stats terminés : « 20 sur 20 · épuisé » ou « 5 sur 15 ». */
export function flashDropFinishedStats(drop: FlashDrop): string {
  const used = drop.current_uses ?? 0;
  if (drop.max_uses != null) {
    const base = `${used} sur ${drop.max_uses}`;
    if (used >= drop.max_uses) return `${base} · épuisé`;
    return base;
  }
  return `${used} · sans limite`;
}

/** « Jeudi 22 oct. » */
export function formatParisDateShort(
  input: Date | string,
  locale = 'fr-FR'
): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const raw = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: PARIS,
  }).format(date);
  const capped = raw.charAt(0).toUpperCase() + raw.slice(1);
  return capped.replace(/\.$/, '');
}

/** « Ven. 16 oct. · 08:00 → 10:00 » */
export function formatDropWhenRange(drop: FlashDrop): string {
  const day = formatParisDateShort(drop.starts_at);
  const start = formatParisTimeHHMM(drop.starts_at);
  const end = formatParisTimeHHMM(drop.ends_at);
  const shortDay = day.replace(/^(\w+)/, (w) => `${w.slice(0, 3)}.`);
  return `${shortDay} · ${start} → ${end}`;
}

/** « 18:00 → 19:30 » pour programmés. */
export function formatDropTimeRange(drop: FlashDrop): string {
  return `${formatParisTimeHHMM(drop.starts_at)} → ${formatParisTimeHHMM(drop.ends_at)}`;
}

function parisDayKey(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** « Commence dans N jours » (calendrier Paris). */
export function formatStartsInDaysLabel(
  startsAt: string,
  nowMs: number = Date.now()
): string {
  const startKey = parisDayKey(startsAt);
  const nowKey = parisDayKey(new Date(nowMs));
  if (startKey === nowKey) return "Commence aujourd'hui";

  const startMs = new Date(`${startKey}T12:00:00`).getTime();
  const nowDayMs = new Date(`${nowKey}T12:00:00`).getTime();
  const diffDays = Math.round((startMs - nowDayMs) / 86_400_000);

  if (diffDays === 1) return 'Commence demain';
  if (diffDays > 1) {
    return `Commence dans ${diffDays} jour${diffDays === 1 ? '' : 's'}`;
  }
  return 'Commence bientôt';
}
