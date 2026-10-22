import { describe, expect, it } from 'vitest';
import type { PlaceMedia } from '@/lib/api/placeMedia';
import { buildPlaceGallery, sectionForIndex } from '@/lib/placeGallery';

function media(
  id: string,
  category: PlaceMedia['category'],
  sort_order = 0
): PlaceMedia {
  return {
    id,
    place_id: 'p1',
    category,
    url: `https://cdn.test/${id}.jpg`,
    storage_path: null,
    sort_order,
    created_at: '',
  };
}

describe('buildPlaceGallery', () => {
  it('garde la photo de couverture seule quand il n’y a pas de galerie', () => {
    const g = buildPlaceGallery([], 'https://cdn.test/cover.jpg');
    expect(g.photos).toEqual([
      { url: 'https://cdn.test/cover.jpg', category: 'venue' },
    ]);
    expect(g.sections).toEqual([
      { category: 'venue', label: 'Le Lieu', firstIndex: 0, count: 1 },
    ]);
  });

  it('renvoie une galerie vide sans photo ni couverture', () => {
    expect(buildPlaceGallery([], null)).toEqual({ photos: [], sections: [] });
  });

  it('range les photos par catégorie puis par ordre', () => {
    const g = buildPlaceGallery(
      [media('menu', 'menu'), media('b', 'venue', 2), media('food', 'food'), media('a', 'venue', 1)],
      null
    );
    expect(g.photos.map((p) => p.url)).toEqual([
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
      'https://cdn.test/food.jpg',
      'https://cdn.test/menu.jpg',
    ]);
    expect(g.sections.map((s) => [s.category, s.firstIndex, s.count])).toEqual([
      ['venue', 0, 2],
      ['food', 2, 1],
      ['menu', 3, 1],
    ]);
  });

  it('ne double pas la couverture si elle fait déjà partie de la galerie', () => {
    const g = buildPlaceGallery(
      [media('food', 'food'), media('a', 'venue')],
      'https://cdn.test/food.jpg'
    );
    expect(g.photos.map((p) => p.url)).toEqual([
      'https://cdn.test/a.jpg',
      'https://cdn.test/food.jpg',
    ]);
  });

  it('place la couverture en tête du lieu quand elle est absente de la galerie', () => {
    const g = buildPlaceGallery([media('a', 'venue')], 'https://cdn.test/cover.jpg');
    expect(g.photos.map((p) => p.url)).toEqual([
      'https://cdn.test/cover.jpg',
      'https://cdn.test/a.jpg',
    ]);
    expect(sectionForIndex(g, 1)?.category).toBe('venue');
    expect(sectionForIndex(g, 5)).toBeUndefined();
  });
});
