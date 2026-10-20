import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CoffeeJar from '@/components/gamification/CoffeeJar';
import CheckInActionButton from '@/components/check-in/CheckInActionButton';

// Mock Supabase pour isoler les composants UI
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

describe('CoffeeJar (Bocal à Grains)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche 50 / 100 pour un solde mocké de 50 Grains', async () => {
    vi.useFakeTimers();
    render(<CoffeeJar totalGrains={50} size="md" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText(/50/)).toBeInTheDocument();
    expect(screen.getByText(/\/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/Grains/i)).toBeInTheDocument();
  });

  it('affiche le modulo 100 (150 Grains → 50 / 100 dans le bocal)', async () => {
    vi.useFakeTimers();
    render(<CoffeeJar totalGrains={150} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });
});

describe('CheckInActionButton (proximité GPS)', () => {
  it('est cliquable quand distance < 100 m', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CheckInActionButton distanceM={42} onClick={onClick} />);

    const btn = screen.getByRole('button', { name: /check-in/i });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('est désactivé quand distance > 100 m', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CheckInActionButton distanceM={250} onClick={onClick} />);

    const btn = screen.getByRole('button', { name: /trop loin/i });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('est désactivé sans GPS', () => {
    render(<CheckInActionButton distanceM={null} />);
    expect(screen.getByRole('button', { name: /gps requis/i })).toBeDisabled();
  });
});
