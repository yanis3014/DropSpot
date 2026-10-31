import { describe, expect, it } from 'vitest';
import { chunk, OPEN_STATUS_BATCH } from '@/lib/api/openingHours';

describe('chunk (places_open_status batches)', () => {
  it('splits 1 201 ids into batches of the server cap', () => {
    const ids = Array.from({ length: 1201 }, (_, i) => String(i));
    const batches = chunk(ids, OPEN_STATUS_BATCH);
    expect(batches.map((b) => b.length)).toEqual([500, 500, 201]);
    expect(batches.flat()).toEqual(ids);
  });

  it('returns no batch for no id', () => {
    expect(chunk([], OPEN_STATUS_BATCH)).toEqual([]);
  });
});
