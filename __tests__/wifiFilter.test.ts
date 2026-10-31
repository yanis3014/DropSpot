import { describe, expect, it } from 'vitest';
import type { Place } from '@/lib/api/places';
import { placeMatchesFilters, type PlacePulse } from '@/lib/filters';
import type { PlaceSpec } from '@/lib/specs';

function place(extra: Partial<Place> = {}): Place {
  return { id: 'p1', name: 'Café test', laptop_policy: 'always', ...extra } as Place;
}

function wifi(status: PlaceSpec['status'], yes = 0, no = 0): PlaceSpec {
  return {
    place_id: 'p1',
    spec: 'wifi',
    declared: status === 'declared',
    yes_votes: yes,
    no_votes: no,
    score: yes - no,
    status,
    last_vote_at: null,
  };
}

describe('Wi-Fi filter', () => {
  it('does not let every café through when the pulse is missing', () => {
    // laptop_policy has a default on every café: it says nothing about Wi-Fi.
    expect(placeMatchesFilters(place(), ['wifi'])).toBe(false);
    expect(placeMatchesFilters(place({ wifi_speed: 'average' }), ['wifi'])).toBe(false);
    expect(placeMatchesFilters(place({ wifi_speed: 'fast' }), ['wifi'])).toBe(true);
  });

  it('shows a café with more good than slow Wi-Fi answers', () => {
    const pulse = (s: PlaceSpec): PlacePulse => ({ specs: { p1: { wifi: s } } });
    expect(placeMatchesFilters(place(), ['wifi'], pulse(wifi('pending', 1, 0)))).toBe(true);
    expect(placeMatchesFilters(place(), ['wifi'], pulse(wifi('pending', 1, 1)))).toBe(false);
    expect(placeMatchesFilters(place(), ['wifi'], pulse(wifi('confirmed', 3, 0)))).toBe(true);
    expect(placeMatchesFilters(place(), ['wifi'], pulse(wifi('disputed', 1, 2)))).toBe(false);
    expect(placeMatchesFilters(place(), ['wifi'], { specs: {} })).toBe(false);
  });
});
