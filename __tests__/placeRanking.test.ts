import { describe, expect, it } from 'vitest';
import {
  ordinal,
  rankChange,
  rankChipLabel,
  sortPlaces,
  specScore,
  specsForAnswers,
} from '@/lib/placeRanking';
import type { PlaceSpec, PlaceSpecMap, SpecId } from '@/lib/specs';

function spec(id: SpecId, score: number, status: PlaceSpec['status'] = 'confirmed'): PlaceSpec {
  return {
    place_id: 'x',
    spec: id,
    declared: false,
    yes_votes: 3,
    no_votes: 0,
    score,
    status,
    last_vote_at: null,
  };
}

const near = { id: 'near', name: 'Near', distanceM: 200 };
const far = { id: 'far', name: 'Far', distanceM: 1500 };
const unknown = { id: 'unknown', name: 'Unknown', distanceM: null };

describe('specsForAnswers', () => {
  it('maps envies and must-haves to specificities without duplicates', () => {
    expect(specsForAnswers({ envies: ['work', 'matcha'], needs: ['wifi', 'terrace'] }).sort()).toEqual(
      ['calm', 'laptop', 'matcha', 'plugs', 'terrace', 'wifi'].sort()
    );
    expect(specsForAnswers({})).toEqual([]);
  });
});

describe('specScore', () => {
  it('counts only positive wanted specs', () => {
    const specs: PlaceSpecMap = {
      wifi: spec('wifi', 3),
      matcha: spec('matcha', 2, 'disputed'),
      calm: spec('calm', 0.5),
    };
    expect(specScore(specs, ['wifi', 'matcha'])).toBe(3);
    // Every positive spec when nothing is wanted; small scores count 1.
    expect(specScore(specs, [])).toBe(4);
  });
});

describe('sortPlaces', () => {
  const specsByPlace: Record<string, PlaceSpecMap> = {
    far: { wifi: spec('wifi', 4) },
    near: { wifi: spec('wifi', 1) },
  };

  it('sorts by distance, unknown last', () => {
    expect(sortPlaces([unknown, far, near], 'distance', { specsByPlace, wanted: [] }).map((p) => p.id)).toEqual([
      'near',
      'far',
      'unknown',
    ]);
  });

  it('« Les mieux confirmés » ignores distance', () => {
    expect(sortPlaces([near, far], 'confirmed', { specsByPlace, wanted: ['wifi'] })[0].id).toBe('far');
  });

  it('« Pour toi » lets a further café win only with a clearly better score', () => {
    expect(sortPlaces([near, far], 'for_you', { specsByPlace, wanted: ['wifi'] })[0].id).toBe('far');
    const close: Record<string, PlaceSpecMap> = {
      far: { wifi: spec('wifi', 1.5) },
      near: { wifi: spec('wifi', 1) },
    };
    expect(sortPlaces([far, near], 'for_you', { specsByPlace: close, wanted: ['wifi'] })[0].id).toBe('near');
  });
});

describe('rank labels', () => {
  it('formats ordinals, chips and weekly change', () => {
    expect(ordinal(1)).toBe('1er');
    expect(ordinal(2)).toBe('2e');
    expect(rankChipLabel('wifi', 2)).toBe('2e pour le Wi-Fi à Nice');
    expect(rankChipLabel('plugs', 1)).toBeNull();
    expect(rankChange(3, null)).toEqual({ label: 'Nouveau', trend: 'new' });
    expect(rankChange(3, 3)).toBeNull();
    expect(rankChange(1, 4)).toEqual({ label: '+3', trend: 'up' });
    expect(rankChange(5, 2)).toEqual({ label: '−3', trend: 'down' });
  });
});
