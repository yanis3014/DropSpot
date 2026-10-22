/** Strip to 6 alphanumeric chars (drop code). */
export function normalizeDropCodeRaw(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
}

/** Display as XX-0000 (maquette / claim_drop code_display). */
export function formatDropCodeDisplay(raw: string): string {
  const n = normalizeDropCodeRaw(raw);
  if (n.length <= 2) return n;
  return `${n.slice(0, 2)}-${n.slice(2)}`;
}
