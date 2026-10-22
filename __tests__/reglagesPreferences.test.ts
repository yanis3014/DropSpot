import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUIET_FROM,
  DEFAULT_QUIET_TO,
  defaultPreferenceRows,
  mergePreferenceDefaults,
  NOTIFICATION_EVENT_DEFAULTS,
} from '@/lib/api/notificationPreferences';
import { teamErrorMessage } from '@/app/(pro)/dashboard-pro/lib/api/team';
import { canAccessProPath, filterProNavHref } from '@/lib/pro/navAccess';

describe('NOTIFICATION_EVENT_DEFAULTS', () => {
  it('expose les 6 événements maquette avec leurs canaux par défaut', () => {
    expect(NOTIFICATION_EVENT_DEFAULTS).toEqual([
      {
        event: 'drop_ending_soon',
        label: 'Un drop se termine bientôt',
        note: '15 min avant la fin',
        defaultPush: true,
        defaultEmail: false,
      },
      {
        event: 'drop_sold_out',
        label: 'Un drop est épuisé',
        note: 'Toutes les places sont utilisées',
        defaultPush: true,
        defaultEmail: false,
      },
      {
        event: 'info_reported',
        label: 'Un client signale une info',
        note: 'Wi-Fi, horaires, spécificités',
        defaultPush: true,
        defaultEmail: true,
      },
      {
        event: 'info_status_changed',
        label: 'Une info est confirmée ou retirée',
        note: 'Par la communauté',
        defaultPush: false,
        defaultEmail: true,
      },
      {
        event: 'verification_progress',
        label: 'Ta vérification avance',
        note: 'Revendication d’un café',
        defaultPush: true,
        defaultEmail: true,
      },
      {
        event: 'daily_summary',
        label: 'Résumé du jour',
        note: 'Chaque soir à 20:00',
        defaultPush: false,
        defaultEmail: true,
      },
    ]);
  });

  it('inclut la ligne global avec silence 22:00–07:00', () => {
    const rows = defaultPreferenceRows();
    const global = rows.find((r) => r.event === 'global');
    expect(global).toEqual({
      event: 'global',
      push: true,
      email: false,
      quietFrom: DEFAULT_QUIET_FROM,
      quietTo: DEFAULT_QUIET_TO,
    });
    expect(DEFAULT_QUIET_FROM).toBe('22:00');
    expect(DEFAULT_QUIET_TO).toBe('07:00');
    expect(rows).toHaveLength(7);
  });

  it('merge les lignes DB sans inventer d’événements hors maquette', () => {
    const merged = mergePreferenceDefaults([
      {
        event: 'drop_ending_soon',
        push: false,
        email: true,
        quietFrom: null,
        quietTo: null,
      },
    ]);
    expect(merged.find((r) => r.event === 'drop_ending_soon')).toMatchObject({
      push: false,
      email: true,
    });
    expect(merged.find((r) => r.event === 'daily_summary')).toMatchObject({
      push: false,
      email: true,
    });
  });
});

describe('message dernier gérant (réglages)', () => {
  it('affiche le message dernier gérant pour leave_place', () => {
    expect(teamErrorMessage('last_owner')).toMatch(/dernier gérant/i);
  });
});

describe('accès /reglages', () => {
  it('autorise owner, manager et staff', () => {
    expect(canAccessProPath('/reglages', 'owner')).toBe(true);
    expect(canAccessProPath('/reglages', 'manager')).toBe(true);
    expect(canAccessProPath('/reglages', 'staff')).toBe(true);
    expect(filterProNavHref('/reglages', 'staff')).toBe(true);
    expect(filterProNavHref('/reglages', 'manager')).toBe(true);
  });
});
