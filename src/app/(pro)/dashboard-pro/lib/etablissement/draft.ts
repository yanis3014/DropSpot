/** Local draft helpers for `/etablissement` (unpublished change count + hours validation). */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type HourSlot = {
  opens: string; // HH:MM
  closes: string;
};

export type DayHoursDraft = {
  weekday: Weekday;
  closed: boolean;
  slots: HourSlot[];
};

export type SpecialHoursDraft = {
  key: string;
  onDate: string; // YYYY-MM-DD
  label: string;
  closed: boolean;
  opens: string | null;
  closes: string | null;
};

export type PhotoDraft = {
  /** Stable key in the draft list (media id or local upload id). */
  key: string;
  id: string | null;
  url: string;
  /** Pending File to upload on publish. */
  file?: File;
  /** Marked for deletion on publish (existing rows only). */
  deleted?: boolean;
};

export type PlaceFicheDraft = {
  name: string;
  address: string;
  description: string;
  hours: DayHoursDraft[];
  specials: SpecialHoursDraft[];
  /** Visible venue photos in display order (deleted filtered out by UI). */
  photos: PhotoDraft[];
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Lun.',
  2: 'Mar.',
  3: 'Mer.',
  4: 'Jeu.',
  5: 'Ven.',
  6: 'Sam.',
  7: 'Dim.',
};

export const DESCRIPTION_MAX = 300;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function emptyWeekHours(): DayHoursDraft[] {
  return ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) => ({
    weekday,
    closed: true,
    slots: [],
  }));
}

export function normalizeTimeInput(raw: string): string {
  const t = raw.trim();
  if (TIME_RE.test(t)) return t;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return t;
  const h = Number(m[1]);
  const min = m[2];
  if (h > 23) return t;
  return `${String(h).padStart(2, '0')}:${min}`;
}

export function timeToMinutes(hhmm: string): number | null {
  const t = normalizeTimeInput(hhmm);
  const m = t.match(TIME_RE);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Fermeture après ouverture, pas de chevauchement entre créneaux du même jour. */
export function validateDaySlots(slots: HourSlot[]): string | null {
  if (slots.length === 0) return null;
  if (slots.length > 2) return 'Deux créneaux maximum par jour.';

  const ranges: { start: number; end: number }[] = [];
  for (const slot of slots) {
    const opens = normalizeTimeInput(slot.opens);
    const closes = normalizeTimeInput(slot.closes);
    if (!TIME_RE.test(opens) || !TIME_RE.test(closes)) {
      return 'Indique des horaires valides (HH:MM).';
    }
    const start = timeToMinutes(opens);
    const end = timeToMinutes(closes);
    if (start === null || end === null) {
      return 'Indique des horaires valides (HH:MM).';
    }
    if (end <= start) {
      return 'La fermeture doit être après l’ouverture.';
    }
    ranges.push({ start, end });
  }

  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i]!.start < ranges[i - 1]!.end) {
      return 'Les créneaux du même jour ne doivent pas se chevaucher.';
    }
  }
  return null;
}

export function validateWeekHours(hours: DayHoursDraft[]): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const day of hours) {
    if (day.closed) continue;
    if (day.slots.length === 0) {
      errors[day.weekday] = 'Ajoute un créneau ou marque le jour comme fermé.';
      continue;
    }
    const err = validateDaySlots(day.slots);
    if (err) errors[day.weekday] = err;
  }
  return errors;
}

export function validateSpecial(special: SpecialHoursDraft): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(special.onDate)) {
    return 'Choisis une date.';
  }
  if (special.closed) return null;
  if (!special.opens || !special.closes) {
    return 'Indique l’ouverture et la fermeture, ou marque Fermé.';
  }
  return validateDaySlots([
    { opens: special.opens, closes: special.closes },
  ]);
}

function hoursSignature(hours: DayHoursDraft[]): string {
  return JSON.stringify(
    hours.map((d) => ({
      weekday: d.weekday,
      closed: d.closed,
      slots: d.closed
        ? []
        : d.slots.map((s) => ({
            opens: normalizeTimeInput(s.opens),
            closes: normalizeTimeInput(s.closes),
          })),
    }))
  );
}

function specialsSignature(specials: SpecialHoursDraft[]): string {
  return JSON.stringify(
    [...specials]
      .map((s) => ({
        onDate: s.onDate,
        label: s.label.trim(),
        closed: s.closed,
        opens: s.closed ? null : s.opens ? normalizeTimeInput(s.opens) : null,
        closes: s.closed ? null : s.closes ? normalizeTimeInput(s.closes) : null,
      }))
      .sort((a, b) => a.onDate.localeCompare(b.onDate) || a.label.localeCompare(b.label))
  );
}

function photosSignature(photos: PhotoDraft[]): string {
  return JSON.stringify(
    photos
      .filter((p) => !p.deleted)
      .map((p) => ({ key: p.key, id: p.id, url: p.url, hasFile: Boolean(p.file) }))
  );
}

/** Compte les blocs modifiés (infos, horaires, exceptionnels, photos). */
export function countUnpublishedChanges(
  baseline: PlaceFicheDraft,
  draft: PlaceFicheDraft
): number {
  let n = 0;
  if (baseline.name.trim() !== draft.name.trim()) n += 1;
  if ((baseline.address ?? '').trim() !== (draft.address ?? '').trim()) n += 1;
  if ((baseline.description ?? '').trim() !== (draft.description ?? '').trim()) {
    n += 1;
  }
  if (hoursSignature(baseline.hours) !== hoursSignature(draft.hours)) n += 1;
  if (specialsSignature(baseline.specials) !== specialsSignature(draft.specials)) {
    n += 1;
  }
  if (photosSignature(baseline.photos) !== photosSignature(draft.photos)) n += 1;
  return n;
}

/** Reorder photos by moving `fromIndex` to `toIndex` (visible list). */
export function reorderPhotos(
  photos: PhotoDraft[],
  fromIndex: number,
  toIndex: number
): PhotoDraft[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= photos.length ||
    toIndex >= photos.length
  ) {
    return photos;
  }
  const next = [...photos];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return photos;
  next.splice(toIndex, 0, item);
  return next;
}

export function formatSpecialDateLabel(
  onDate: string,
  locale = 'fr-FR'
): string {
  const d = new Date(`${onDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return onDate;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Paris',
  }).format(d);
}
