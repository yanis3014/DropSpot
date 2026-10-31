import { describe, expect, it } from 'vitest';
import {
  CLUSTER_MAX_ZOOM,
  boundsOf,
  containsBounds,
  groupPoints,
  padBounds,
} from '@/lib/map/viewport';

const nice = { minLng: 7.2, minLat: 43.68, maxLng: 7.3, maxLat: 43.72 };

describe('padBounds / containsBounds', () => {
  it('grows the area on every side', () => {
    const p = padBounds(nice, 0.5);
    expect(p.minLng).toBeCloseTo(7.15);
    expect(p.maxLng).toBeCloseTo(7.35);
    expect(p.minLat).toBeCloseTo(43.66);
    expect(p.maxLat).toBeCloseTo(43.74);
    expect(containsBounds(p, nice)).toBe(true);
    expect(containsBounds(nice, p)).toBe(false);
  });

  it('stays within the world', () => {
    const p = padBounds({ minLng: -179, minLat: -89, maxLng: 179, maxLat: 89 }, 1);
    expect(p).toEqual({ minLng: -180, minLat: -90, maxLng: 180, maxLat: 90 });
  });

  it('boundsOf returns the smallest box', () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { lat: 43.7, lng: 7.25 },
        { lat: 43.71, lng: 7.27 },
      ])
    ).toEqual({ minLng: 7.25, minLat: 43.7, maxLng: 7.27, maxLat: 43.71 });
  });
});

describe('groupPoints', () => {
  const a = { id: 'a', lat: 43.7, lng: 7.26 };
  const b = { id: 'b', lat: 43.7001, lng: 7.2601 }; // ~15 m from a
  const far = { id: 'far', lat: 43.75, lng: 7.4 };

  it('merges close cafés into one bubble at city zoom', () => {
    const groups = groupPoints([a, b, far], 12);
    const cluster = groups.find((g) => g.kind === 'cluster');
    expect(cluster && cluster.kind === 'cluster' && cluster.items.map((i) => i.id).sort()).toEqual([
      'a',
      'b',
    ]);
    expect(groups.filter((g) => g.kind === 'point').map((g) => g.kind === 'point' && g.item.id)).toEqual([
      'far',
    ]);
  });

  it('shows every café at street zoom', () => {
    const groups = groupPoints([a, b, far], CLUSTER_MAX_ZOOM);
    expect(groups.every((g) => g.kind === 'point')).toBe(true);
    expect(groups).toHaveLength(3);
  });

  it('does not regroup while zoom stays in the same step', () => {
    const key = (z: number) =>
      groupPoints([a, b, far], z)
        .map((g) => (g.kind === 'cluster' ? g.key : g.item.id))
        .sort()
        .join('|');
    expect(key(12.1)).toBe(key(12.9));
  });

  it('keeps every café once', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      id: String(i),
      lat: 43.65 + (i % 17) * 0.004,
      lng: 7.2 + Math.floor(i / 17) * 0.006,
    }));
    for (const z of [10, 12, 13, 14]) {
      const ids = groupPoints(many, z).flatMap((g) =>
        g.kind === 'cluster' ? g.items.map((i) => i.id) : [g.item.id]
      );
      expect(ids.sort()).toEqual(many.map((m) => m.id).sort());
    }
  });
});
