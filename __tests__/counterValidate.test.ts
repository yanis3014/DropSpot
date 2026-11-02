import { describe, expect, it } from 'vitest';
import {
  appendDigitToCode,
  appendKeyToCode,
  DROP_CODE_LETTERS,
  nextSlotIsLetter,
  formatDropCodeDisplay,
  isCompleteDropCode,
  normalizeDropCodeRaw,
} from '@/app/(pro)/dashboard-pro/lib/counterValidate/formatCode';
import {
  buildVerdictViewModel,
  canAddDropPlaces,
  redeemStatusFromResult,
} from '@/app/(pro)/dashboard-pro/lib/counterValidate/verdict';

describe('counterValidate formatCode', () => {
  it('normalise et formate XX-####', () => {
    expect(normalizeDropCodeRaw('mx-48 21')).toBe('MX4821');
    expect(formatDropCodeDisplay('MX4821')).toBe('MX-4821');
  });

  it('append digit respecte 6 caractères max', () => {
    expect(appendDigitToCode('MX48', '2')).toBe('MX482');
    expect(isCompleteDropCode('MX4821')).toBe(true);
    expect(isCompleteDropCode('MX48')).toBe(false);
  });
});

describe('counterValidate verdict', () => {
  it('mappe le statut RPC ok', () => {
    expect(
      redeemStatusFromResult({ ok: true, status: 'ok' }, false)
    ).toBe('ok');
    expect(
      redeemStatusFromResult({ ok: false, status: 'sold_out' }, false)
    ).toBe('sold_out');
    expect(redeemStatusFromResult(null, true)).toBe('offline');
  });

  it('choisit l’écran sold_out avec bouton places pour owner/manager seulement', () => {
    const ownerVm = buildVerdictViewModel({
      status: 'sold_out',
      placeRole: 'owner',
      result: { ok: false, status: 'sold_out', flash_drop_id: 'drop-1' },
      soldOutLabel: 'Les 20 places de ce drop sont toutes utilisées.',
    });
    expect(ownerVm.showAddFivePlaces).toBe(true);

    const staffVm = buildVerdictViewModel({
      status: 'sold_out',
      placeRole: 'staff',
      result: { ok: false, status: 'sold_out', flash_drop_id: 'drop-1' },
      soldOutLabel: 'Les 20 places de ce drop sont toutes utilisées.',
    });
    expect(staffVm.showAddFivePlaces).toBe(false);
  });

  it('canAddDropPlaces', () => {
    expect(canAddDropPlaces('owner')).toBe(true);
    expect(canAddDropPlaces('manager')).toBe(true);
    expect(canAddDropPlaces('staff')).toBe(false);
  });
});

describe('counter keypad (XX-#### codes)', () => {
  it('expects letters for the first two slots, digits after', () => {
    expect(nextSlotIsLetter('')).toBe(true);
    expect(nextSlotIsLetter('M')).toBe(true);
    expect(nextSlotIsLetter('MX')).toBe(false);
  });

  it('builds a full code from letter then digit keys', () => {
    let c = '';
    for (const k of ['M', 'X', '4', '8', '2', '7']) c = appendKeyToCode(c, k);
    expect(c).toBe('MX4827');
    expect(appendKeyToCode(c, '9')).toBe('MX4827');
  });

  it('ignores a key of the wrong kind', () => {
    expect(appendKeyToCode('', '4')).toBe('');
    expect(appendKeyToCode('MX', 'A')).toBe('MX');
  });

  it('keypad letters match the server alphabet (no I, L, O)', () => {
    expect(DROP_CODE_LETTERS).toHaveLength(23);
    expect(DROP_CODE_LETTERS).not.toContain('I');
    expect(DROP_CODE_LETTERS).not.toContain('L');
    expect(DROP_CODE_LETTERS).not.toContain('O');
  });
});

describe('own code verdict', () => {
  it('explains that a self-issued code cannot be validated', () => {
    const vm = buildVerdictViewModel({ status: 'own_code', codeTapped: 'MX4827' });
    expect(vm.kind).toBe('own_code');
    expect(vm.title).toMatch(/propre code/);
    expect(vm.showCancelValidation).toBe(false);
  });
});
