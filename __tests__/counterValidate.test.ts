import { describe, expect, it } from 'vitest';
import {
  appendDigitToCode,
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
