/** Max proof file size: 10 Mo. */
export const CLAIM_PROOF_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png']);

export type ClaimProofValidationError =
  | 'missing_file'
  | 'file_too_large'
  | 'invalid_file_type';

export function claimProofExtension(fileName: string): string {
  const parts = fileName.trim().split('.');
  if (parts.length < 2) return '';
  return (parts.at(-1) ?? '').toLowerCase();
}

/** Returns an error code, or null when the file is acceptable. */
export function validateClaimProofFile(
  file: File | null | undefined
): ClaimProofValidationError | null {
  if (!file) return 'missing_file';
  if (file.size > CLAIM_PROOF_MAX_BYTES) return 'file_too_large';

  const ext = claimProofExtension(file.name);
  const mimeOk = file.type ? ALLOWED_MIME.has(file.type) : false;
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) return 'invalid_file_type';
  if (file.type && !mimeOk) return 'invalid_file_type';
  if (!extOk) return 'invalid_file_type';
  return null;
}

/** Safe filename segment (no path separators). */
export function sanitizeClaimProofFileName(fileName: string): string {
  const base = fileName.trim().replace(/[/\\]/g, '_');
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, '_').replace(/\s+/g, '-');
  return cleaned.slice(0, 120) || 'preuve.pdf';
}

/**
 * Storage object path for claim-proofs bucket.
 * First folder MUST be the auth uid (request_claim enforces it).
 */
export function buildClaimProofPath(
  uid: string,
  placeId: string,
  fileName: string
): string {
  const safe = sanitizeClaimProofFileName(fileName);
  return `${uid}/${placeId}/${safe}`;
}

export function canSubmitClaimStep(opts: {
  certified: boolean;
  file: File | null | undefined;
}): boolean {
  if (!opts.certified) return false;
  return validateClaimProofFile(opts.file) === null;
}

export function placeNameInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0]!.toUpperCase()).join('');
}
