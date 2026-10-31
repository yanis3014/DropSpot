/**
 * Map viewport helpers: areas to load and pin grouping.
 * Pure functions (no Mapbox), so they are unit tested.
 */

export type Bounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

/** Beyond this zoom every café gets its own pin (street level). */
export const CLUSTER_MAX_ZOOM = 15;
/** Size (px) of a grouping cell: pins closer than this merge into a bubble. */
export const CLUSTER_CELL_PX = 60;
/** Each loaded area extends this ratio past the screen on every side. */
export const AREA_PADDING_RATIO = 0.5;

/** `b` grown by `ratio` of its width/height on each side. */
export function padBounds(b: Bounds, ratio: number): Bounds {
  const dLng = (b.maxLng - b.minLng) * ratio;
  const dLat = (b.maxLat - b.minLat) * ratio;
  return {
    minLng: Math.max(-180, b.minLng - dLng),
    minLat: Math.max(-90, b.minLat - dLat),
    maxLng: Math.min(180, b.maxLng + dLng),
    maxLat: Math.min(90, b.maxLat + dLat),
  };
}

/** True when `inner` lies entirely inside `outer`. */
export function containsBounds(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.minLng >= outer.minLng &&
    inner.maxLng <= outer.maxLng &&
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat
  );
}

/** Smallest box around the points. */
export function boundsOf(points: readonly { lat: number; lng: number }[]): Bounds | null {
  if (points.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  return { minLng, minLat, maxLng, maxLat };
}

/** Web Mercator world pixel of a point at an integer zoom (512 px tiles). */
function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 512 * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export type MapGroup<T> =
  | { kind: 'point'; item: T }
  | { kind: 'cluster'; key: string; lat: number; lng: number; items: T[] };

/**
 * Groups points that fall in the same CLUSTER_CELL_PX cell. The grid is
 * fixed in world pixels at the integer zoom, so panning never regroups
 * pins: only a zoom step does.
 */
export function groupPoints<T extends { id: string; lat: number; lng: number }>(
  items: readonly T[],
  zoom: number,
  cellPx: number = CLUSTER_CELL_PX
): MapGroup<T>[] {
  if (zoom >= CLUSTER_MAX_ZOOM) {
    return items.map((item) => ({ kind: 'point' as const, item }));
  }
  const z = Math.max(0, Math.floor(zoom));
  const cells = new Map<string, T[]>();
  for (const item of items) {
    const { x, y } = worldPixel(item.lat, item.lng, z);
    const key = `${z}:${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    const cell = cells.get(key);
    if (cell) cell.push(item);
    else cells.set(key, [item]);
  }
  const out: MapGroup<T>[] = [];
  for (const [key, cellItems] of cells) {
    if (cellItems.length === 1) {
      out.push({ kind: 'point', item: cellItems[0] });
      continue;
    }
    const lat = cellItems.reduce((s, p) => s + p.lat, 0) / cellItems.length;
    const lng = cellItems.reduce((s, p) => s + p.lng, 0) / cellItems.length;
    out.push({ kind: 'cluster', key, lat, lng, items: cellItems });
  }
  return out;
}
