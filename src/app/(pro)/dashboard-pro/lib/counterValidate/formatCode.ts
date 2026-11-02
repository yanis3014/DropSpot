/** Strip to 6 alphanumeric chars (drop code input). */
export function normalizeDropCodeRaw(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
}

/** Display as XX-#### (when at least 3 chars). */
export function formatDropCodeDisplay(raw: string): string {
  const n = normalizeDropCodeRaw(raw);
  if (n.length <= 2) return n;
  return `${n.slice(0, 2)}-${n.slice(2)}`;
}

export function appendDigitToCode(current: string, digit: string): string {
  if (!/^\d$/.test(digit)) return current;
  return normalizeDropCodeRaw(current + digit);
}

/** Letters used by generate_drop_code() (no I, L, O to avoid confusion). */
export const DROP_CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'.split('');

/** Number of leading letters in a drop code (format XX-####). */
export const DROP_CODE_LETTER_COUNT = 2;

/** Does the next slot of the code expect a letter (true) or a digit (false)? */
export function nextSlotIsLetter(current: string): boolean {
  return normalizeDropCodeRaw(current).length < DROP_CODE_LETTER_COUNT;
}

/**
 * Append a key from the counter keypad: letters for the first two slots,
 * digits after. A key of the wrong kind is ignored.
 */
export function appendKeyToCode(current: string, key: string): string {
  const n = normalizeDropCodeRaw(current);
  if (n.length >= 6) return n;
  const k = key.toUpperCase();
  const wantLetter = nextSlotIsLetter(n);
  if (wantLetter ? !/^[A-Z]$/.test(k) : !/^\d$/.test(k)) return n;
  return normalizeDropCodeRaw(n + k);
}

export function backspaceCode(current: string): string {
  return normalizeDropCodeRaw(current).slice(0, -1);
}

export function isCompleteDropCode(raw: string): boolean {
  return normalizeDropCodeRaw(raw).length === 6;
}
