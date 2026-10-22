import { describe, expect, it } from 'vitest';
import {
  countUnpublishedChanges,
  emptyWeekHours,
  reorderPhotos,
  validateDaySlots,
  type PhotoDraft,
  type PlaceFicheDraft,
} from '@/app/(pro)/dashboard-pro/lib/etablissement/draft';

function baseDraft(over: Partial<PlaceFicheDraft> = {}): PlaceFicheDraft {
  return {
    name: 'Tech Café',
    address: '1 rue Test',
    description: 'Bon café',
    hours: emptyWeekHours(),
    specials: [],
    photos: [],
    ...over,
  };
}

describe('countUnpublishedChanges', () => {
  it('retourne 0 si rien n’a changé', () => {
    const d = baseDraft();
    expect(countUnpublishedChanges(d, d)).toBe(0);
  });

  it('compte chaque bloc modifié', () => {
    const baseline = baseDraft();
    const draft = baseDraft({
      name: 'Autre nom',
      description: 'Nouvelle desc',
    });
    expect(countUnpublishedChanges(baseline, draft)).toBe(2);
  });

  it('détecte un changement d’horaires', () => {
    const baseline = baseDraft();
    const hours = emptyWeekHours().map((d) =>
      d.weekday === 1
        ? {
            ...d,
            closed: false,
            slots: [{ opens: '08:00', closes: '19:00' }],
          }
        : d
    );
    expect(
      countUnpublishedChanges(baseline, baseDraft({ hours }))
    ).toBe(1);
  });

  it('détecte un changement de photos', () => {
    const photos: PhotoDraft[] = [
      { key: 'a', id: 'a', url: 'https://x/a.jpg' },
    ];
    expect(
      countUnpublishedChanges(
        baseDraft(),
        baseDraft({ photos })
      )
    ).toBe(1);
  });
});

describe('validateDaySlots', () => {
  it('exige fermeture après ouverture', () => {
    expect(
      validateDaySlots([{ opens: '18:00', closes: '09:00' }])
    ).toMatch(/fermeture/i);
    expect(
      validateDaySlots([{ opens: '09:00', closes: '09:00' }])
    ).toMatch(/fermeture/i);
  });

  it('refuse les chevauchements', () => {
    expect(
      validateDaySlots([
        { opens: '09:00', closes: '14:00' },
        { opens: '13:00', closes: '18:00' },
      ])
    ).toMatch(/chevauch/i);
  });

  it('accepte deux créneaux disjoints', () => {
    expect(
      validateDaySlots([
        { opens: '09:00', closes: '12:00' },
        { opens: '14:00', closes: '18:00' },
      ])
    ).toBeNull();
  });
});

describe('reorderPhotos', () => {
  it('réordonne les photos (principale = index 0)', () => {
    const photos: PhotoDraft[] = [
      { key: '1', id: '1', url: '/1.jpg' },
      { key: '2', id: '2', url: '/2.jpg' },
      { key: '3', id: '3', url: '/3.jpg' },
    ];
    const next = reorderPhotos(photos, 2, 0);
    expect(next.map((p) => p.key)).toEqual(['3', '1', '2']);
    expect(next[0]?.key).toBe('3');
  });

  it('ne change rien si les index sont invalides', () => {
    const photos: PhotoDraft[] = [
      { key: '1', id: '1', url: '/1.jpg' },
    ];
    expect(reorderPhotos(photos, 0, 0)).toEqual(photos);
    expect(reorderPhotos(photos, 5, 0)).toEqual(photos);
  });
});
