export type DropFormExample = {
  id: string;
  title: string;
  kind: 'discount' | 'offer' | 'special_price' | 'activity';
  conditions?: string;
  description?: string;
};

export const DROP_FORM_EXAMPLES: DropFormExample[] = [
  {
    id: '1',
    title: '−30 % sur le matcha latte',
    kind: 'discount',
    conditions: 'sur place uniquement',
    description: 'Réduction flash sur le matcha latte.',
  },
  {
    id: '2',
    title: 'Cookie offert avec un café',
    kind: 'offer',
    conditions: '1 par personne',
    description: 'Un cookie maison avec toute boisson chaude.',
  },
  {
    id: '3',
    title: 'Atelier latte art',
    kind: 'activity',
    conditions: '6 places',
    description: 'Initiation latte art · 1 h 30.',
  },
];
