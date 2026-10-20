import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FlashDropForm from '@/app/dashboard-pro/components/FlashDropForm';
import type { Place } from '@/lib/api/places';

const mockCreateFlashDrop = vi.fn();

vi.mock('@/app/dashboard-pro/lib/api/flashDrops', () => ({
  createFlashDrop: (...args: unknown[]) => mockCreateFlashDrop(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'vendor-user-id',
            email: 'cafe@dropspot.test',
          },
        },
        error: null,
      }),
    },
  },
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'vendor-user-id', email: 'cafe@dropspot.test' },
    isAuthenticated: true,
    loading: false,
    signOut: vi.fn(),
    email: 'cafe@dropspot.test',
    displayName: 'Bloom Café',
    avatarUrl: null,
  }),
}));

vi.mock('@/app/dashboard-pro/hooks/useVendorProfile', () => ({
  useVendorProfile: () => ({
    profile: {
      id: 'vendor-user-id',
      full_name: 'Bloom Café',
      avatar_url: null,
      role: 'vendor' as const,
    },
    loading: false,
    refresh: vi.fn(),
    save: vi.fn(),
  }),
}));

const mockPlace: Place = {
  id: 'place-1',
  name: 'Bloom Specialty Coffee',
  lat: 43.71,
  lng: 7.26,
  categories: [],
  address: '4 Bd Victor Hugo',
  city: 'Nice',
};

describe('Dashboard Pro — FlashDropForm (vendor)', () => {
  beforeEach(() => {
    mockCreateFlashDrop.mockReset();
    mockCreateFlashDrop.mockResolvedValue({
      id: 'drop-1',
      vendor_id: 'vendor-user-id',
      place_id: 'place-1',
      title: '-20% lattes',
      description: null,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 3600_000).toISOString(),
      is_active: true,
      pin_code: '4242',
    });
  });

  it('rend le formulaire de création de Flash Drop', () => {
    render(<FlashDropForm places={[mockPlace]} />);

    expect(
      screen.getByRole('heading', { name: /créer un flash drop/i })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/lattes/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /publier le flash drop/i })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue(/bloom specialty coffee/i)).toBeInTheDocument();
  });

  it('réagit à la saisie du titre', async () => {
    const user = userEvent.setup();
    render(<FlashDropForm places={[mockPlace]} />);

    const titleInput = screen.getByPlaceholderText(/lattes/i);
    await user.type(titleInput, '-20% sur les lattes');

    expect(titleInput).toHaveValue('-20% sur les lattes');
  });

  it('publie un Flash Drop via l’API mockée', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<FlashDropForm places={[mockPlace]} onCreated={onCreated} />);

    await user.type(
      screen.getByPlaceholderText(/lattes/i),
      '-20% lattes'
    );
    await user.click(
      screen.getByRole('button', { name: /publier le flash drop/i })
    );

    expect(mockCreateFlashDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '-20% lattes',
        place_id: 'place-1',
      })
    );
    expect(
      await screen.findByText(/flash drop « -20% lattes » publié/i)
    ).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalled();
  });
});
