import type {
  FlashDrop,
  FlashDropKind,
} from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';
import type { DropFormExample } from '@/app/(pro)/dashboard-pro/lib/proDrops/examples';
import { formatParisTimeHHMM } from '@/app/(pro)/dashboard-pro/lib/proHome/parisTime';
import type { EventCategory } from '@/lib/api/drops';

const PARIS = 'Europe/Paris';

export const DEFAULT_DROP_CONDITIONS =
  'Sur place uniquement. 1 par personne.';

export interface DropFormState {
  title: string;
  description: string;
  kind: FlashDropKind;
  /** Events only (kind = activity). Null until the café picks one. */
  eventCategory: EventCategory | null;
  discountValue: string;
  discountUnit: 'percent' | 'eur';
  startsAtLocal: string;
  endsAtLocal: string;
  quantityMode: 'limited' | 'unlimited';
  maxUses: string;
  conditions: string;
}

export interface DropContentWritePayload {
  place_id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  kind: FlashDropKind;
  event_category: EventCategory | null;
  discount_value: number | null;
  discount_unit: 'percent' | 'eur' | null;
  conditions: string | null;
  starts_at: string;
  ends_at: string;
  max_uses: number | null;
}

function getParisParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = Number.parseInt(part.value, 10);
    }
  }
  return {
    year: map.year ?? 1970,
    month: map.month ?? 1,
    day: map.day ?? 1,
    hour: (map.hour ?? 0) % 24,
    minute: map.minute ?? 0,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Formats an instant (Date or ISO string) as `YYYY-MM-DDTHH:mm` in Europe/Paris.
 */
export function formatParisDatetimeLocal(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';
  const p = getParisParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Parses a `YYYY-MM-DDTHH:mm` string interpreted in `Europe/Paris`
 * and returns the corresponding UTC ISO string (`toISOString()`).
 * Handles CET (+01:00) and CEST (+02:00) transitions including Oct 25, 2026.
 */
export function parseParisDatetimeLocalToUtcIso(localValue: string): string {
  const match = localValue
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error('Format de date invalide');
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4], 10);
  const minute = Number.parseInt(match[5], 10);
  const second = match[6] ? Number.parseInt(match[6], 10) : 0;

  // Treat the wall-clock components as if they were UTC first
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  // Europe/Paris is either UTC+2 (summer) or UTC+1 (winter).
  // Evaluate candidate offsets (+2h then +1h, so during the autumn fold 02:xx defaults to standard/summer consistently)
  for (const offsetHours of [2, 1]) {
    const candidateMs = wallAsUtcMs - offsetHours * 3_600_000;
    const p = getParisParts(new Date(candidateMs));
    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    ) {
      return new Date(candidateMs).toISOString();
    }
  }

  // Fallback for spring-forward gap (e.g. 02:30 on last Sunday of March):
  // compute offset at wallAsUtcMs and adjust once.
  const approxParts = getParisParts(new Date(wallAsUtcMs));
  const approxWallMs = Date.UTC(
    approxParts.year,
    approxParts.month - 1,
    approxParts.day,
    approxParts.hour,
    approxParts.minute,
    second
  );
  const offsetMs = approxWallMs - wallAsUtcMs;
  return new Date(wallAsUtcMs - offsetMs).toISOString();
}

/**
 * Shifts a past/existing drop's start & end times to today in Europe/Paris,
 * preserving the wall-clock start time and the original duration.
 */
export function shiftDropDatesToTodayParis(
  startsAtIso: string,
  endsAtIso: string,
  now: Date = new Date()
): { startsAtLocal: string; endsAtLocal: string } {
  const startDate = new Date(startsAtIso);
  const endDate = new Date(endsAtIso);
  const durationMs =
    Number.isFinite(startDate.getTime()) &&
    Number.isFinite(endDate.getTime()) &&
    endDate.getTime() > startDate.getTime()
      ? endDate.getTime() - startDate.getTime()
      : 2 * 3_600_000;

  const todayParis = getParisParts(now);
  const origStartParis = Number.isFinite(startDate.getTime())
    ? getParisParts(startDate)
    : { ...todayParis, minute: 0 };

  const startsAtLocal = `${todayParis.year}-${pad2(todayParis.month)}-${pad2(todayParis.day)}T${pad2(origStartParis.hour)}:${pad2(origStartParis.minute)}`;
  const newStartUtcIso = parseParisDatetimeLocalToUtcIso(startsAtLocal);
  const newEndDate = new Date(new Date(newStartUtcIso).getTime() + durationMs);
  const endsAtLocal = formatParisDatetimeLocal(newEndDate);

  return { startsAtLocal, endsAtLocal };
}

/**
 * Formats « Copié depuis « <titre> » du <date> » in Europe/Paris.
 */
export function formatCopiedFromBanner(
  drop: Pick<FlashDrop, 'title' | 'starts_at'>,
  locale = 'fr-FR'
): string {
  const d = new Date(drop.starts_at);
  const dateLabel = Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: PARIS,
      }).format(d)
    : '';
  return dateLabel
    ? `Copié depuis « ${drop.title} » du ${dateLabel}`
    : `Copié depuis « ${drop.title} »`;
}

/**
 * Computes « Dure 2 h · heure de Paris » from two Paris datetime-local values.
 */
export function formatDropDurationHint(
  startsAtLocal: string,
  endsAtLocal: string
): string | null {
  try {
    const startMs = new Date(
      parseParisDatetimeLocalToUtcIso(startsAtLocal)
    ).getTime();
    const endMs = new Date(
      parseParisDatetimeLocalToUtcIso(endsAtLocal)
    ).getTime();
    const diffMin = Math.round((endMs - startMs) / 60_000);
    if (!Number.isFinite(diffMin) || diffMin <= 0) return null;

    const hours = Math.floor(diffMin / 60);
    const minutes = diffMin % 60;
    let dur: string;
    if (hours === 0) {
      dur = `${minutes} min`;
    } else if (minutes === 0) {
      dur = `${hours} h`;
    } else {
      dur = `${hours} h ${pad2(minutes)}`;
    }
    return `Dure ${dur} · heure de Paris`;
  } catch {
    return null;
  }
}

/**
 * Returns the primary submit button label:
 * - « Programmer » when starts_at is in the future (> nowMs + 60s tolerance or > nowMs)
 * - « Publier à HH:MM » otherwise.
 */
export function getDropSubmitLabel(
  startsAtLocal: string,
  nowMs: number = Date.now()
): string {
  try {
    const startIso = parseParisDatetimeLocalToUtcIso(startsAtLocal);
    const startMs = new Date(startIso).getTime();
    if (startMs > nowMs) {
      return 'Programmer';
    }
    const hhmm = formatParisTimeHHMM(startIso);
    return `Publier à ${hhmm}`;
  } catch {
    return 'Publier';
  }
}

/**
 * Whether a drop can be edited (only scheduled drops: starts_at in the future and stopped_at null).
 */
export function isDropEditable(
  drop: Pick<FlashDrop, 'starts_at' | 'stopped_at'>,
  nowMs: number = Date.now()
): boolean {
  if (drop.stopped_at) return false;
  const startMs = new Date(drop.starts_at).getTime();
  return Number.isFinite(startMs) && startMs > nowMs;
}

export function buildDefaultDropFormState(now: Date = new Date()): DropFormState {
  const start = new Date(now.getTime());
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  // Events first: most cafés start with something they already organise.
  return {
    title: '',
    description: '',
    kind: 'activity',
    eventCategory: null,
    discountValue: '20',
    discountUnit: 'percent',
    startsAtLocal: formatParisDatetimeLocal(start),
    endsAtLocal: formatParisDatetimeLocal(end),
    quantityMode: 'unlimited',
    maxUses: '20',
    conditions: '',
  };
}

export function buildFormStateFromDrop(
  drop: FlashDrop,
  options: { shiftToToday?: boolean; now?: Date } = {}
): DropFormState {
  const now = options.now ?? new Date();
  const dates = options.shiftToToday
    ? shiftDropDatesToTodayParis(drop.starts_at, drop.ends_at, now)
    : {
        startsAtLocal: formatParisDatetimeLocal(drop.starts_at),
        endsAtLocal: formatParisDatetimeLocal(drop.ends_at),
      };

  const kind: FlashDropKind = drop.kind ?? 'offer';
  const discountUnit: 'percent' | 'eur' =
    drop.discount_unit === 'eur' ? 'eur' : 'percent';

  let discountValue = '20';
  if (drop.discount_value != null && Number.isFinite(drop.discount_value)) {
    discountValue = String(drop.discount_value);
  } else {
    const matchPct = drop.title.match(/(\d+)\s*%/);
    if (matchPct) discountValue = matchPct[1];
  }

  return {
    title: drop.title.slice(0, 60),
    description: drop.description ?? '',
    kind,
    eventCategory: kind === 'activity' ? (drop.event_category ?? 'other') : null,
    discountValue,
    discountUnit: kind === 'special_price' ? 'eur' : discountUnit,
    startsAtLocal: dates.startsAtLocal,
    endsAtLocal: dates.endsAtLocal,
    quantityMode: drop.max_uses != null ? 'limited' : 'unlimited',
    maxUses: drop.max_uses != null ? String(drop.max_uses) : '20',
    conditions:
      drop.conditions != null && drop.conditions.trim() !== ''
        ? drop.conditions
        : kind === 'activity'
          ? ''
          : DEFAULT_DROP_CONDITIONS,
  };
}

export function buildFormStateFromExample(
  example: DropFormExample,
  now: Date = new Date()
): DropFormState {
  const base = buildDefaultDropFormState(now);
  const matchPct = example.title.match(/(\d+)\s*%/);
  const matchPlaces = example.conditions?.match(/^(\d+)\s*places?$/i);
  return {
    ...base,
    title: example.title.slice(0, 60),
    description: example.description ?? '',
    kind: example.kind,
    eventCategory: example.kind === 'activity' ? (example.eventCategory ?? 'other') : null,
    discountValue: matchPct ? matchPct[1] : base.discountValue,
    discountUnit: example.kind === 'special_price' ? 'eur' : 'percent',
    maxUses: matchPlaces ? matchPlaces[1] : base.maxUses,
    quantityMode: example.kind === 'activity' && !matchPlaces ? 'unlimited' : 'limited',
    conditions:
      example.kind === 'activity'
        ? ''
        : (example.conditions ?? DEFAULT_DROP_CONDITIONS),
  };
}

export interface DropValidationResult {
  valid: boolean;
  error?: string;
  payload?: DropContentWritePayload;
}

export function validateDropFormState(
  state: DropFormState,
  ctx: { placeId: string; vendorId: string }
): DropValidationResult {
  const title = state.title.trim();
  if (!title) {
    return { valid: false, error: 'Le titre est obligatoire.' };
  }
  if (title.length > 60) {
    return {
      valid: false,
      error: 'Le titre ne peut pas dépasser 60 caractères.',
    };
  }

  if (!ctx.placeId || !ctx.vendorId) {
    return { valid: false, error: 'Aucun établissement sélectionné.' };
  }

  if (state.kind === 'activity' && !state.eventCategory) {
    return { valid: false, error: 'Choisis le type d’événement.' };
  }

  let discountValue: number | null = null;
  let discountUnit: 'percent' | 'eur' | null = null;

  if (state.kind === 'discount') {
    const parsed = Number(state.discountValue.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { valid: false, error: 'Indique un montant de réduction valide.' };
    }
    if (state.discountUnit === 'percent') {
      if (parsed < 1 || parsed > 90) {
        return {
          valid: false,
          error: 'La réduction en % doit être comprise entre 1 et 90.',
        };
      }
    }
    discountValue = parsed;
    discountUnit = state.discountUnit;
  } else if (state.kind === 'special_price') {
    const parsed = Number(state.discountValue.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { valid: false, error: 'Indique le prix spécial en euros.' };
    }
    discountValue = parsed;
    discountUnit = 'eur';
  }

  let startsAtIso: string;
  let endsAtIso: string;
  try {
    startsAtIso = parseParisDatetimeLocalToUtcIso(state.startsAtLocal);
    endsAtIso = parseParisDatetimeLocalToUtcIso(state.endsAtLocal);
  } catch {
    return { valid: false, error: 'Dates de début ou de fin invalides.' };
  }

  if (new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()) {
    return { valid: false, error: 'La fin doit être après le début.' };
  }

  let maxUses: number | null = null;
  if (state.quantityMode === 'limited') {
    const parsedMax = Number.parseInt(state.maxUses, 10);
    if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
      return {
        valid: false,
        error: 'Le nombre de places doit être supérieur à 0.',
      };
    }
    maxUses = parsedMax;
  }

  return {
    valid: true,
    payload: {
      place_id: ctx.placeId,
      vendor_id: ctx.vendorId,
      title,
      description: state.description.trim() || null,
      kind: state.kind,
      event_category: state.kind === 'activity' ? state.eventCategory : null,
      discount_value: discountValue,
      discount_unit: discountUnit,
      conditions: state.conditions.trim() || null,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      max_uses: maxUses,
    },
  };
}

/**
 * Translates database / RLS errors into user-facing French messages.
 */
export function translateDropWriteError(
  err: unknown,
  options: { role?: string | null; hasPro?: boolean } = {}
): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const message =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : String(err ?? '');

  if (message.includes('flash_drops: place must be verified')) {
    return "Ce café n'est pas encore vérifié";
  }

  if (
    options.role === 'manager' &&
    options.hasPro === false &&
    (code === '42501' ||
      /row-level security/i.test(message) ||
      /pro_required/i.test(message))
  ) {
    return "Ton café doit être en Pro pour qu'un responsable crée des drops";
  }

  if (code === '42501' || /row-level security/i.test(message)) {
    return "Tu n'as pas le droit de créer un drop ici";
  }

  if (message.includes('ends_at must be after starts_at')) {
    return 'La fin doit être après le début.';
  }

  return message || 'Impossible d’enregistrer ce drop.';
}
