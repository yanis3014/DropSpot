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

export function backspaceCode(current: string): string {
  return normalizeDropCodeRaw(current).slice(0, -1);
}

export function isCompleteDropCode(raw: string): boolean {
  return normalizeDropCodeRaw(raw).length === 6;
}
