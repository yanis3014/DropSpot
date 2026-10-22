import { describe, expect, it } from 'vitest';
import {
  buildClaimProofPath,
  canSubmitClaimStep,
  CLAIM_PROOF_MAX_BYTES,
  validateClaimProofFile,
} from '@/app/(pro)/dashboard-pro/lib/onboarding/claimProof';

function fakeFile(
  name: string,
  size: number,
  type: string
): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 64))], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('claimProof validation', () => {
  it('bloque l’étape sans case cochée ni fichier', () => {
    expect(canSubmitClaimStep({ certified: false, file: null })).toBe(false);
    expect(
      canSubmitClaimStep({
        certified: true,
        file: null,
      })
    ).toBe(false);
    expect(
      canSubmitClaimStep({
        certified: false,
        file: fakeFile('kbis.pdf', 1000, 'application/pdf'),
      })
    ).toBe(false);
    expect(
      canSubmitClaimStep({
        certified: true,
        file: fakeFile('kbis.pdf', 1000, 'application/pdf'),
      })
    ).toBe(true);
  });

  it('refuse un fichier trop lourd', () => {
    const heavy = fakeFile(
      'gros.pdf',
      CLAIM_PROOF_MAX_BYTES + 1,
      'application/pdf'
    );
    expect(validateClaimProofFile(heavy)).toBe('file_too_large');
  });

  it('refuse un type non autorisé', () => {
    expect(
      validateClaimProofFile(fakeFile('note.docx', 1000, 'application/msword'))
    ).toBe('invalid_file_type');
    expect(
      validateClaimProofFile(fakeFile('photo.webp', 1000, 'image/webp'))
    ).toBe('invalid_file_type');
  });

  it('accepte PDF, JPG et PNG sous 10 Mo', () => {
    expect(
      validateClaimProofFile(fakeFile('a.pdf', 10, 'application/pdf'))
    ).toBeNull();
    expect(
      validateClaimProofFile(fakeFile('a.jpg', 10, 'image/jpeg'))
    ).toBeNull();
    expect(
      validateClaimProofFile(fakeFile('a.png', 10, 'image/png'))
    ).toBeNull();
  });

  it('construit le chemin <uid>/<place_id>/…', () => {
    const uid = '11111111-1111-1111-1111-111111111111';
    const placeId = '22222222-2222-2222-2222-222222222222';
    const path = buildClaimProofPath(uid, placeId, 'Mon Kbis (1).PDF');
    expect(path.startsWith(`${uid}/${placeId}/`)).toBe(true);
    expect(path.split('/')).toHaveLength(3);
    expect(path).not.toContain(' ');
  });
});
