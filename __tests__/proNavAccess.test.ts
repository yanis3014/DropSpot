import { describe, expect, it } from 'vitest';
import {
  canAccessProPath,
  filterProNavHref,
  mobileTabHrefsForRole,
  moreNavHrefsForRole,
  isMoreNavPath,
} from '@/lib/pro/navAccess';

const SIDE_NAV = [
  '/dashboard-pro',
  '/dashboard-pro/drops',
  '/etablissement',
  '/specificites',
  '/equipe',
  '/abonnement',
  '/reglages',
] as const;

const MOBILE_NAV = [
  '/dashboard-pro',
  '/valider',
  '/dashboard-pro/drops',
] as const;

describe('ProShell nav visibility by role', () => {
  it('staff : accueil, valider, spécificités, réglages (+ établissement via READ_ALL)', () => {
    expect(filterProNavHref('/dashboard-pro', 'staff')).toBe(true);
    expect(filterProNavHref('/valider', 'staff')).toBe(true);
    expect(filterProNavHref('/specificites', 'staff')).toBe(true);
    expect(filterProNavHref('/reglages', 'staff')).toBe(true);
    expect(filterProNavHref('/etablissement', 'staff')).toBe(true);
    expect(filterProNavHref('/dashboard-pro/drops', 'staff')).toBe(false);
    expect(filterProNavHref('/equipe', 'staff')).toBe(false);
    expect(filterProNavHref('/abonnement', 'staff')).toBe(false);
  });

  it('manager : drops + lecture, pas équipe ni abonnement', () => {
    for (const href of SIDE_NAV) {
      const allowed = filterProNavHref(href, 'manager');
      if (href === '/equipe' || href === '/abonnement') {
        expect(allowed).toBe(false);
      } else {
        expect(allowed).toBe(true);
      }
    }
    for (const href of MOBILE_NAV) {
      expect(filterProNavHref(href, 'manager')).toBe(true);
    }
  });

  it('owner : toutes les entrées ProShell', () => {
    for (const href of [...SIDE_NAV, ...MOBILE_NAV]) {
      expect(filterProNavHref(href, 'owner')).toBe(true);
    }
  });
});

describe('canAccessProPath (deep-link → accueil si interdit)', () => {
  it('refuse équipe / abonnement aux non-owners', () => {
    expect(canAccessProPath('/equipe', 'staff')).toBe(false);
    expect(canAccessProPath('/abonnement', 'manager')).toBe(false);
    expect(canAccessProPath('/equipe', 'owner')).toBe(true);
  });

  it('refuse drops au staff', () => {
    expect(canAccessProPath('/dashboard-pro/drops', 'staff')).toBe(false);
    expect(canAccessProPath('/dashboard-pro/drops/nouveau', 'manager')).toBe(
      true
    );
  });

  it('autorise valider et réglages à tous les rôles', () => {
    expect(canAccessProPath('/valider', 'staff')).toBe(true);
    expect(canAccessProPath('/reglages', 'staff')).toBe(true);
  });
});

describe('feuille Plus', () => {
  it('ne contient ni Équipe ni Abonnement pour un staff', () => {
    const hrefs = moreNavHrefsForRole('staff');
    expect(hrefs).toEqual(['/etablissement', '/specificites', '/reglages']);
    expect(hrefs).not.toContain('/equipe');
    expect(hrefs).not.toContain('/abonnement');
  });

  it('ne répète pas la fiche, déjà dans la barre, pour un gérant', () => {
    expect(moreNavHrefsForRole('owner')).toEqual([
      '/specificites',
      '/equipe',
      '/abonnement',
      '/reglages',
    ]);
    expect(isMoreNavPath('/etablissement', 'owner')).toBe(false);
    expect(isMoreNavPath('/etablissement', 'staff')).toBe(true);
  });
});

describe('barre du bas mobile', () => {
  it('garde Valider au centre pour chaque rôle', () => {
    for (const role of ['owner', 'manager', 'staff'] as const) {
      // + l'onglet Plus en dernier
      const tabs = [...mobileTabHrefsForRole(role), 'plus'];
      expect(tabs.length % 2).toBe(1);
      expect(tabs[(tabs.length - 1) / 2]).toBe('/valider');
    }
  });

  it('montre Drops au gérant et au responsable, pas au staff', () => {
    expect(mobileTabHrefsForRole('owner')).toContain('/dashboard-pro/drops');
    expect(mobileTabHrefsForRole('manager')).toContain('/dashboard-pro/drops');
    expect(mobileTabHrefsForRole('staff')).toEqual(['/dashboard-pro', '/valider']);
  });
});
