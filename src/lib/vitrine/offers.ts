/** Public landing path for café owners (no splash, full-width shell). */
export const VITRINE_PATH = '/pour-les-cafes';

/*
 * Offres proposées par Souley (dossier financier, octobre 2026). Prix HT par
 * café et par mois. Non définitifs : mettre priceHt à null pour masquer un prix.
 */

export type OfferFeature = { label: string; available: boolean };

export type Offer = {
  id: 'presence' | 'analytics' | 'premium';
  name: string;
  tagline: string;
  /** null = prix pas encore public. */
  priceHt: number | null;
  highlighted: boolean;
  /** Ex. "Tout Présence, plus :" */
  includesPrevious: string | null;
  features: OfferFeature[];
};

/** Paiement à l'année : 2 mois offerts (proposition de Souley). */
export const ANNUAL_FREE_MONTHS = 2;
export const SHOW_ANNUAL_NOTE = true;

export const OFFERS: Offer[] = [
  {
    id: 'presence',
    name: 'Présence',
    tagline: 'Être sur la carte',
    priceHt: 0,
    highlighted: false,
    includesPrevious: null,
    features: [
      { label: 'Votre café sur la carte Dropspot', available: true },
      { label: 'Votre fiche : horaires, photos, ce que vous proposez', available: true },
      { label: 'Les infos confirmées par les clients sur place', available: true },
      { label: 'Corriger une info qui n’est plus juste', available: true },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    tagline: 'Comprendre qui vient',
    priceHt: 39,
    highlighted: false,
    includesPrevious: 'Tout Présence, plus :',
    features: [
      { label: 'Vos chiffres de la semaine : vues, passages, favoris', available: false },
      { label: 'Vos heures de pointe et vos heures creuses', available: false },
      { label: 'Nouveaux clients et habitués', available: false },
      { label: 'L’évolution d’un mois à l’autre', available: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Faire venir du monde',
    priceHt: 79,
    highlighted: true,
    includesPrevious: 'Tout Analytics, plus :',
    features: [
      { label: 'Vos événements et offres sur la carte (les drops)', available: true },
      { label: 'Validation au comptoir par QR code ou code', available: true },
      { label: 'Vos équipiers valident les codes', available: true },
      { label: 'Un événement qui revient chaque semaine, publié tout seul', available: false },
    ],
  },
];

const PRICE_FORMAT = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** "Gratuit", "Tarif annoncé au lancement" or a euro amount such as "39 €". */
export function formatOfferPrice(offer: Pick<Offer, 'priceHt'>): string {
  if (offer.priceHt === 0) return 'Gratuit';
  if (offer.priceHt === null) return 'Tarif annoncé au lancement';
  return PRICE_FORMAT.format(offer.priceHt);
}

/** Yearly price HT when paying upfront (ANNUAL_FREE_MONTHS offered). */
export function annualPriceHt(priceHt: number): number {
  return priceHt * (12 - ANNUAL_FREE_MONTHS);
}

/** Same euro formatting as the monthly price, for the yearly note. */
export function formatEuros(amount: number): string {
  return PRICE_FORMAT.format(amount);
}
