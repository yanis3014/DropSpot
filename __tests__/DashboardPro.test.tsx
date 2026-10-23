import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DropForm from '@/app/(pro)/dashboard-pro/components/DropForm';
import QuickDropSheet from '@/app/(pro)/dashboard-pro/components/QuickDropSheet';
import {
  buildDefaultDropFormState,
  buildFormStateFromDrop,
  buildFormStateFromExample,
  DEFAULT_DROP_CONDITIONS,
  formatCopiedFromBanner,
  formatDropDurationHint,
  formatParisDatetimeLocal,
  getDropSubmitLabel,
  isDropEditable,
  parseParisDatetimeLocalToUtcIso,
  shiftDropDatesToTodayParis,
  translateDropWriteError,
  validateDropFormState,
} from '@/app/(pro)/dashboard-pro/lib/proDrops/dropForm';
import type { Place } from '@/lib/api/places';
import type { FlashDrop } from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';

const mockInsertFlashDrop = vi.fn();
const mockUpdateFlashDrop = vi.fn();
const mockGetRecentPlaceFlashDrops = vi.fn();
const mockGetPlaceOpenStatus = vi.fn();

vi.mock('@/app/(pro)/dashboard-pro/lib/api/flashDrops', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/app/(pro)/dashboard-pro/lib/api/flashDrops')
    >();
  return {
    ...actual,
    insertFlashDrop: (...args: unknown[]) => mockInsertFlashDrop(...args),
    updateFlashDrop: (...args: unknown[]) => mockUpdateFlashDrop(...args),
    getRecentPlaceFlashDrops: (...args: unknown[]) =>
      mockGetRecentPlaceFlashDrops(...args),
  };
});

vi.mock('@/lib/api/openingHours', () => ({
  getPlaceOpenStatus: (...args: unknown[]) => mockGetPlaceOpenStatus(...args),
}));

const verifiedPlace: Place = {
  id: 'place-1',
  name: 'Tech Café Sophia',
  lat: 43.62,
  lng: 7.05,
  categories: [],
  address: '4 Bd Victor Hugo',
  city: 'Biot',
  vendor_id: 'vendor-user-id',
  verification_status: 'verified',
};

const pendingPlace: Place = {
  ...verifiedPlace,
  id: 'place-2',
  name: 'Maison Verte',
  verification_status: 'pending',
};

describe('Europe/Paris ↔ UTC conversion (y compris le 25 octobre 2026)', () => {
  it('convertit une heure d’été (CEST, UTC+2) avant le 25 octobre 2026', () => {
    const utcIso = parseParisDatetimeLocalToUtcIso('2026-10-22T15:00');
    expect(utcIso).toBe('2026-10-22T13:00:00.000Z');
    expect(formatParisDatetimeLocal(utcIso)).toBe('2026-10-22T15:00');
  });

  it('gère le changement d’heure du 25 octobre 2026 (passage CEST → CET)', () => {
    // 25 oct. 2026 à 01:30 Paris = encore en heure d’été (UTC+2) -> 2026-10-24T23:30:00.000Z
    const beforeSwitch = parseParisDatetimeLocalToUtcIso('2026-10-25T01:30');
    expect(beforeSwitch).toBe('2026-10-24T23:30:00.000Z');

    // 25 oct. 2026 à 04:00 Paris = heure d’hiver (UTC+1) -> 2026-10-25T03:00:00.000Z
    const afterSwitch = parseParisDatetimeLocalToUtcIso('2026-10-25T04:00');
    expect(afterSwitch).toBe('2026-10-25T03:00:00.000Z');
    expect(formatParisDatetimeLocal(afterSwitch)).toBe('2026-10-25T04:00');

    // 25 oct. 2026 à 15:00 Paris = heure d’hiver (UTC+1) -> 14:00 UTC
    const afternoonWinter = parseParisDatetimeLocalToUtcIso('2026-10-25T15:00');
    expect(afternoonWinter).toBe('2026-10-25T14:00:00.000Z');
  });
});

describe('Validation des champs de DropForm', () => {
  const ctx = { placeId: 'place-1', vendorId: 'vendor-user-id' };

  it('refuse un titre vide ou de plus de 60 caractères', () => {
    const base = buildDefaultDropFormState(new Date('2026-10-22T12:00:00.000Z'));
    expect(validateDropFormState({ ...base, title: '   ' }, ctx).valid).toBe(
      false
    );
    expect(
      validateDropFormState({ ...base, title: 'x'.repeat(61) }, ctx).valid
    ).toBe(false);
  });

  it('exige un prix pour un prix spécial, sans valeur inventée', () => {
    const base = {
      ...buildDefaultDropFormState(new Date('2026-10-22T12:00:00.000Z')),
      title: 'Flat white à prix doux',
      kind: 'special_price' as const,
    };

    expect(
      validateDropFormState({ ...base, discountValue: '' }, ctx).valid
    ).toBe(false);

    const ok = validateDropFormState({ ...base, discountValue: '2,5' }, ctx);
    expect(ok.valid).toBe(true);
    expect(ok.payload?.discount_value).toBe(2.5);
    expect(ok.payload?.discount_unit).toBe('eur');
  });

  it('impose entre 1 et 90 pour une réduction en %', () => {
    const base = {
      ...buildDefaultDropFormState(new Date('2026-10-22T12:00:00.000Z')),
      title: '−20 % sur les boissons chaudes',
      kind: 'discount' as const,
      discountUnit: 'percent' as const,
    };

    expect(
      validateDropFormState({ ...base, discountValue: '0' }, ctx).valid
    ).toBe(false);
    expect(
      validateDropFormState({ ...base, discountValue: '95' }, ctx).valid
    ).toBe(false);

    const ok = validateDropFormState({ ...base, discountValue: '30' }, ctx);
    expect(ok.valid).toBe(true);
    expect(ok.payload?.discount_value).toBe(30);
    expect(ok.payload?.discount_unit).toBe('percent');
  });

  it('accepte une réduction en € et vérifie que la fin est après le début', () => {
    const base = {
      ...buildDefaultDropFormState(new Date('2026-10-22T12:00:00.000Z')),
      title: 'Réduction 2 €',
      kind: 'discount' as const,
      discountUnit: 'eur' as const,
      discountValue: '2',
      startsAtLocal: '2026-10-22T15:00',
      endsAtLocal: '2026-10-22T14:00',
    };

    const badDates = validateDropFormState(base, ctx);
    expect(badDates.valid).toBe(false);
    expect(badDates.error).toMatch(/après le début/i);

    const validEur = validateDropFormState(
      { ...base, endsAtLocal: '2026-10-22T17:00' },
      ctx
    );
    expect(validEur.valid).toBe(true);
    expect(validEur.payload?.discount_unit).toBe('eur');
    expect(validEur.payload?.discount_value).toBe(2);
  });

  it('gère max_uses limité ou sans limite (null)', () => {
    const base = {
      ...buildDefaultDropFormState(new Date('2026-10-22T12:00:00.000Z')),
      title: 'Cookie offert',
      kind: 'offer' as const,
    };

    const unlimited = validateDropFormState(
      { ...base, quantityMode: 'unlimited' },
      ctx
    );
    expect(unlimited.valid).toBe(true);
    expect(unlimited.payload?.max_uses).toBeNull();

    const limited = validateDropFormState(
      { ...base, quantityMode: 'limited', maxUses: '15' },
      ctx
    );
    expect(limited.valid).toBe(true);
    expect(limited.payload?.max_uses).toBe(15);
  });
});

describe('Préremplissage depuis un drop existant et choix Programmer / Publier', () => {
  const existingDrop: FlashDrop = {
    id: 'drop-old',
    vendor_id: 'vendor-user-id',
    place_id: 'place-1',
    title: '−20 % sur les boissons chaudes',
    description: 'Chocolat, latte, cappuccino',
    kind: 'discount',
    discount_value: 20,
    discount_unit: 'percent',
    conditions: 'Sur place uniquement. 1 par personne.',
    starts_at: '2026-10-16T13:00:00.000Z', // 15:00 Paris (CEST)
    ends_at: '2026-10-16T15:00:00.000Z', // 17:00 Paris (CEST)
    max_uses: 20,
    is_active: false,
  };

  it('décale les dates à aujourd’hui tout en gardant l’heure de Paris et la durée', () => {
    const now = new Date('2026-10-22T09:00:00.000Z');
    const shifted = shiftDropDatesToTodayParis(
      existingDrop.starts_at,
      existingDrop.ends_at,
      now
    );
    expect(shifted).toEqual({
      startsAtLocal: '2026-10-22T15:00',
      endsAtLocal: '2026-10-22T17:00',
    });

    const prefilled = buildFormStateFromDrop(existingDrop, {
      shiftToToday: true,
      now,
    });
    expect(prefilled.title).toBe('−20 % sur les boissons chaudes');
    expect(prefilled.kind).toBe('discount');
    expect(prefilled.discountValue).toBe('20');
    expect(prefilled.discountUnit).toBe('percent');
    expect(prefilled.maxUses).toBe('20');
    expect(prefilled.conditions).toBe(DEFAULT_DROP_CONDITIONS);
    expect(prefilled.startsAtLocal).toBe('2026-10-22T15:00');
    expect(prefilled.endsAtLocal).toBe('2026-10-22T17:00');
    expect(
      formatDropDurationHint(prefilled.startsAtLocal, prefilled.endsAtLocal)
    ).toBe('Dure 2 h · heure de Paris');
    expect(formatCopiedFromBanner(existingDrop)).toContain(
      'Copié depuis « −20 % sur les boissons chaudes » du'
    );
  });

  it('préremplit aussi depuis un exemple (DROP_FORM_EXAMPLES)', () => {
    const exState = buildFormStateFromExample(
      {
        id: '1',
        title: '−30 % sur le matcha latte',
        kind: 'discount',
        conditions: 'sur place uniquement',
      },
      new Date('2026-10-22T13:00:00.000Z')
    );
    expect(exState.title).toBe('−30 % sur le matcha latte');
    expect(exState.discountValue).toBe('30');
    expect(exState.conditions).toBe('sur place uniquement');
  });

  it('choisit « Programmer » si le début est dans le futur, sinon « Publier à HH:MM »', () => {
    const nowMs = new Date('2026-10-22T13:00:00.000Z').getTime(); // 15:00 Paris
    expect(getDropSubmitLabel('2026-10-22T16:30', nowMs)).toBe('Programmer');
    expect(getDropSubmitLabel('2026-10-22T15:00', nowMs)).toBe(
      'Publier à 15:00'
    );
    expect(getDropSubmitLabel('2026-10-22T14:15', nowMs)).toBe(
      'Publier à 14:15'
    );
  });

  it('autorise la modification uniquement pour un drop programmé non arrêté', () => {
    const nowMs = new Date('2026-10-22T13:00:00.000Z').getTime();
    expect(
      isDropEditable(
        { starts_at: '2026-10-22T16:00:00.000Z', stopped_at: null },
        nowMs
      )
    ).toBe(true);
    expect(
      isDropEditable(
        { starts_at: '2026-10-22T12:00:00.000Z', stopped_at: null },
        nowMs
      )
    ).toBe(false);
    expect(
      isDropEditable(
        {
          starts_at: '2026-10-22T16:00:00.000Z',
          stopped_at: '2026-10-22T12:30:00.000Z',
        },
        nowMs
      )
    ).toBe(false);
  });

  it('traduit les erreurs Supabase en français', () => {
    expect(
      translateDropWriteError(new Error('flash_drops: place must be verified'))
    ).toBe("Ce café n'est pas encore vérifié");
    expect(
      translateDropWriteError(
        { code: '42501', message: 'new row violates row-level security' },
        { role: 'owner', hasPro: false }
      )
    ).toBe("Tu n'as pas le droit de créer un drop ici");
    expect(
      translateDropWriteError(
        { code: '42501', message: 'new row violates row-level security' },
        { role: 'manager', hasPro: false }
      )
    ).toBe("Ton café doit être en Pro pour qu'un responsable crée des drops");
  });
});

describe('Composant DropForm', () => {
  beforeEach(() => {
    mockInsertFlashDrop.mockReset();
    mockUpdateFlashDrop.mockReset();
  });

  it('affiche l’état « Drops bientôt disponibles » quand le café n’est pas vérifié', () => {
    render(<DropForm place={pendingPlace} />);
    expect(
      screen.getByRole('heading', { name: /drops bientôt disponibles/i })
    ).toBeInTheDocument();
  });

  it('soumet uniquement les colonnes de contenu + vendor_id du café actif', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const initial = {
      ...buildDefaultDropFormState(new Date('2026-10-22T13:00:00.000Z')),
      kind: 'discount' as const,
      quantityMode: 'limited' as const,
      conditions: DEFAULT_DROP_CONDITIONS,
      startsAtLocal: '2026-10-22T15:00',
      endsAtLocal: '2026-10-22T17:00',
    };
    mockInsertFlashDrop.mockResolvedValue({
      id: 'drop-created',
      vendor_id: 'vendor-user-id',
      place_id: 'place-1',
      title: '−20 % sur les boissons chaudes',
      starts_at: '2026-10-22T13:00:00.000Z',
      ends_at: '2026-10-22T15:00:00.000Z',
      is_active: true,
    });

    render(
      <DropForm
        place={verifiedPlace}
        initialState={initial}
        onSaved={onSaved}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: /nouveau drop pour tech café sophia/i,
      })
    ).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/titre/i);
    await user.type(titleInput, '−20 % sur les boissons chaudes');

    const submitBtn = screen.getByRole('button', {
      name: /publier à|programmer/i,
    });
    await user.click(submitBtn);

    expect(mockInsertFlashDrop).toHaveBeenCalledTimes(1);
    const payload = mockInsertFlashDrop.mock.calls[0][0];
    expect(payload).toEqual({
      place_id: 'place-1',
      vendor_id: 'vendor-user-id',
      title: '−20 % sur les boissons chaudes',
      description: null,
      kind: 'discount',
      event_category: null,
      discount_value: 20,
      discount_unit: 'percent',
      conditions: DEFAULT_DROP_CONDITIONS,
      starts_at: '2026-10-22T13:00:00.000Z',
      ends_at: '2026-10-22T15:00:00.000Z',
      max_uses: 20,
    });
    expect(payload).not.toHaveProperty('grains_reward');
    expect(payload).not.toHaveProperty('current_uses');
    expect(payload).not.toHaveProperty('pin_code');
    expect(payload).not.toHaveProperty('is_active');
    expect(payload).not.toHaveProperty('stopped_at');
    expect(onSaved).toHaveBeenCalled();
  });
});

describe('Composant DropForm (événement)', () => {
  beforeEach(() => {
    mockInsertFlashDrop.mockReset();
  });

  it('demande le type d’événement puis l’envoie avec le drop', async () => {
    const user = userEvent.setup();
    const initial = {
      ...buildDefaultDropFormState(new Date('2026-10-22T13:00:00.000Z')),
      startsAtLocal: '2026-10-25T09:00',
      endsAtLocal: '2026-10-25T11:00',
    };
    mockInsertFlashDrop.mockResolvedValue({
      id: 'event-created',
      vendor_id: 'vendor-user-id',
      place_id: 'place-1',
      title: 'Run du dimanche',
      starts_at: '2026-10-25T08:00:00.000Z',
      ends_at: '2026-10-25T10:00:00.000Z',
      is_active: true,
    });

    render(<DropForm place={verifiedPlace} initialState={initial} />);

    await user.type(screen.getByLabelText(/titre/i), 'Run du dimanche');
    const submitBtn = screen.getByRole('button', {
      name: /publier à|programmer/i,
    });
    await user.click(submitBtn);
    expect(mockInsertFlashDrop).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/type d’événement/i);

    await user.click(screen.getByRole('button', { name: 'Sport' }));
    await user.click(submitBtn);

    expect(mockInsertFlashDrop).toHaveBeenCalledTimes(1);
    const payload = mockInsertFlashDrop.mock.calls[0][0];
    expect(payload).toMatchObject({
      kind: 'activity',
      event_category: 'sport',
      max_uses: null,
    });
  });
});

describe('Feuille QuickDropSheet (téléphone)', () => {
  beforeEach(() => {
    mockInsertFlashDrop.mockReset();
    mockGetRecentPlaceFlashDrops.mockReset();
    mockGetPlaceOpenStatus.mockReset();
  });

  it('affiche les 3 derniers drops, l’heure de fermeture si place_open_status la renvoie, et publie maintenant', async () => {
    const user = userEvent.setup();
    mockGetRecentPlaceFlashDrops.mockResolvedValue([
      {
        id: 'r1',
        vendor_id: 'vendor-user-id',
        place_id: 'place-1',
        title: 'Matcha −30 %',
        kind: 'discount',
        discount_value: 30,
        discount_unit: 'percent',
        starts_at: '2026-10-20T13:00:00.000Z',
        ends_at: '2026-10-20T15:00:00.000Z',
        max_uses: 20,
        is_active: false,
      },
      {
        id: 'r2',
        vendor_id: 'vendor-user-id',
        place_id: 'place-1',
        title: 'Cookie offert',
        kind: 'offer',
        starts_at: '2026-10-19T13:00:00.000Z',
        ends_at: '2026-10-19T15:00:00.000Z',
        max_uses: null,
        is_active: false,
      },
    ]);
    mockGetPlaceOpenStatus.mockResolvedValue({
      ok: true,
      has_hours: true,
      is_open: true,
      status: 'open',
      closes_at: '23:59',
      timezone: 'Europe/Paris',
    });
    mockInsertFlashDrop.mockResolvedValue({
      id: 'quick-1',
      vendor_id: 'vendor-user-id',
      place_id: 'place-1',
      title: '−30 % sur le matcha latte',
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 3600_000).toISOString(),
      is_active: true,
    });

    const onClose = vi.fn();
    const onPublished = vi.fn();

    render(
      <QuickDropSheet
        open={true}
        place={verifiedPlace}
        role="owner"
        hasPro={false}
        onClose={onClose}
        onPublished={onPublished}
      />
    );

    expect(await screen.findByText('Matcha −30 %')).toBeInTheDocument();
    expect(screen.getByText('Cookie offert')).toBeInTheDocument();
    expect(await screen.findByText(/Jusqu'à 23:59/i)).toBeInTheDocument();
    expect(screen.getByText(/Visible de \d{2}:\d{2} à \d{2}:\d{2} · 20 places/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /publier maintenant/i }));

    expect(mockInsertFlashDrop).toHaveBeenCalledTimes(1);
    expect(mockInsertFlashDrop.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        place_id: 'place-1',
        vendor_id: 'vendor-user-id',
        title: '−30 % sur le matcha latte',
        kind: 'discount',
        discount_value: 30,
        discount_unit: 'percent',
        max_uses: 20,
      })
    );
    expect(onPublished).toHaveBeenCalled();
  });
});
