import { describe, expect, it } from 'vitest';
import {
  annualPriceHt,
  formatOfferPrice,
  OFFERS,
} from '@/lib/vitrine/offers';

/** Intl inserts a narrow no-break space before €; compare on plain spaces. */
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('vitrine offers', () => {
  it('has three offers with unique ids', () => {
    expect(OFFERS).toHaveLength(3);
    expect(new Set(OFFERS.map((o) => o.id)).size).toBe(3);
  });

  it('highlights exactly one offer', () => {
    expect(OFFERS.filter((o) => o.highlighted)).toHaveLength(1);
  });

  it('formats prices', () => {
    expect(formatOfferPrice({ priceHt: 0 })).toBe('Gratuit');
    expect(formatOfferPrice({ priceHt: null })).toBe(
      'Tarif annoncé au lancement'
    );
    expect(plain(formatOfferPrice({ priceHt: 39 }))).toBe('39 €');
  });

  it('computes the yearly price with free months', () => {
    expect(annualPriceHt(39)).toBe(390);
  });
});
