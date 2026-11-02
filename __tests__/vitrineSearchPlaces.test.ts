import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase/client';
import { searchPlacesPublic } from '@/lib/vitrine/searchPlaces';

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

const fromMock = vi.mocked(supabase!.from);

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const limit = vi
    .fn()
    .mockResolvedValue({ data: result.data ?? [], error: result.error ?? null });
  const order = vi.fn(() => ({ limit }));
  const ilike = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ ilike }));
  fromMock.mockReturnValue({ select } as never);
  return { select, ilike, order, limit };
}

describe('searchPlacesPublic', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('returns [] without any query below 2 characters', async () => {
    expect(await searchPlacesPublic('')).toEqual([]);
    expect(await searchPlacesPublic(' a ')).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('escapes ilike wildcards in the input', async () => {
    const { ilike } = mockQuery({});
    await searchPlacesPublic('50%_\\off');
    expect(ilike).toHaveBeenCalledWith('name', '%50\\%\\_\\\\off%');
  });

  it('maps area and free from the public columns only', async () => {
    const { select } = mockQuery({
      data: [
        {
          id: '1',
          name: 'Maison Grain',
          address: '12 rue Pastorelli',
          city: 'Nice',
          verification_status: 'unclaimed',
        },
        {
          id: '2',
          name: 'Cafe du Port',
          address: null,
          city: 'Nice',
          verification_status: 'claimed',
        },
        {
          id: '3',
          name: 'Kiosque',
          address: '',
          city: null,
          verification_status: 'unclaimed',
        },
      ],
    });
    const hits = await searchPlacesPublic('grain');
    // Never select owner-related columns: only the public ones.
    expect(select).toHaveBeenCalledWith(
      'id, name, address, city, verification_status'
    );
    expect(hits).toEqual([
      { id: '1', name: 'Maison Grain', area: '12 rue Pastorelli', free: true },
      { id: '2', name: 'Cafe du Port', area: 'Nice', free: false },
      { id: '3', name: 'Kiosque', area: null, free: true },
    ]);
  });

  it('returns [] on error and never throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery({ error: { message: 'boom' } });
    expect(await searchPlacesPublic('maison')).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
