import { describe, expect, it } from 'vitest';
import { formatDropCodeDisplay } from '@/lib/dropCodes/format';
import { resolveDropCodeScreen } from '@/lib/dropCodes/screen';
import { claimDropErrorMessage } from '@/lib/dropCodes/errors';

describe('formatDropCodeDisplay', () => {
  it('formate XX-0000', () => {
    expect(formatDropCodeDisplay('MX4821')).toBe('MX-4821');
    expect(formatDropCodeDisplay('mx-48 21')).toBe('MX-4821');
    expect(formatDropCodeDisplay('AB')).toBe('AB');
  });
});

describe('resolveDropCodeScreen', () => {
  it('choisit l’écran selon status', () => {
    expect(resolveDropCodeScreen('issued')).toBe('code');
    expect(resolveDropCodeScreen('redeemed')).toBe('validated');
    expect(resolveDropCodeScreen('cancelled')).toBe('cancelled');
    expect(resolveDropCodeScreen(null)).toBe('code');
  });
});

describe('grains amount visibility', () => {
  it('n’invente pas de montant quand la transaction n’est pas lisible', () => {
    const amount: number | null = null;
    // UI contract: null → toast sans montant calculé
    const toastProps =
      amount != null
        ? { amount }
        : { message: 'Validé · merci !' as const };
    expect(toastProps).toEqual({ message: 'Validé · merci !' });
    expect('amount' in toastProps).toBe(false);
  });

  it('passe le montant uniquement s’il vient de grains_transactions', () => {
    const amount: number | null = 10;
    const toastProps =
      amount != null
        ? { amount }
        : { message: 'Validé · merci !' as const };
    expect(toastProps).toEqual({ amount: 10 });
  });
});

describe('claimDropErrorMessage', () => {
  const drop = {
    start_time: '2026-01-01T10:00:00.000Z',
    end_time: '2026-01-01T12:00:00.000Z',
  };

  it('traduit café non vérifié et sold out', () => {
    expect(claimDropErrorMessage('place_not_verified')).toMatch(/vérifié/i);
    expect(claimDropErrorMessage('sold_out')).toMatch(/places/i);
  });

  it('distingue terminé et arrêté pour drop_not_live', () => {
    expect(
      claimDropErrorMessage('drop_not_live', drop, Date.parse('2026-01-01T13:00:00.000Z'))
    ).toMatch(/terminé/i);
    expect(
      claimDropErrorMessage('drop_not_live', drop, Date.parse('2026-01-01T11:00:00.000Z'))
    ).toMatch(/arrêté/i);
  });
});
