const PARIS = 'Europe/Paris';

/** « lundi 19 octobre » (Paris). */
export function formatParisDateLong(
  date: Date = new Date(),
  locale = 'fr-FR'
): string {
  const raw = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: PARIS,
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** HH:MM en Europe/Paris. */
export function formatParisTimeHHMM(
  input: Date | string,
  locale = 'fr-FR'
): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: PARIS,
  }).format(date);
}

/** Bandeau offline « date de HH:MM ». */
export function formatParisSnapshotLabel(date: Date = new Date()): string {
  return formatParisTimeHHMM(date);
}

/** « lun. 19 oct., 10:42 » (Europe/Paris) — suivi de revendication. */
export function formatParisClaimSentAt(
  input: Date | string,
  locale = 'fr-FR'
): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const dayPart = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: PARIS,
  }).format(date);
  return `${dayPart}, ${formatParisTimeHHMM(date, locale)}`;
}
