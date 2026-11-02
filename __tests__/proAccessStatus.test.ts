import { describe, expect, it } from 'vitest';
import {
  isProGatedPath,
  parseProAccessStatus,
  proGateRedirect,
  PRO_WAITING_PATH,
  PRO_WELCOME_PATH,
} from '@/lib/pro/accessStatus';
import { destinationAfterAuth } from '@/lib/auth/redirect';

describe('proGateRedirect', () => {
  it('sends a gérant waiting for approval to the waiting screen', () => {
    for (const path of [
      '/dashboard-pro',
      '/dashboard-pro/drops',
      '/etablissement',
      '/equipe',
      '/valider',
      '/statistiques',
    ]) {
      expect(proGateRedirect(path, 'pending')).toBe(PRO_WAITING_PATH);
      expect(proGateRedirect(path, 'none')).toBe(PRO_WAITING_PATH);
    }
  });

  it('shows the welcome screen first once approved', () => {
    expect(proGateRedirect('/dashboard-pro', 'welcome')).toBe(PRO_WELCOME_PATH);
    expect(proGateRedirect('/etablissement', 'welcome')).toBe(PRO_WELCOME_PATH);
  });

  it('lets an active pro through', () => {
    expect(proGateRedirect('/dashboard-pro', 'active')).toBeNull();
    expect(proGateRedirect('/equipe', 'active')).toBeNull();
  });

  it('never gates the request, welcome and invitation pages (no loop)', () => {
    for (const state of ['none', 'pending', 'welcome', 'active'] as const) {
      expect(proGateRedirect(PRO_WAITING_PATH, state)).toBeNull();
      expect(proGateRedirect(PRO_WELCOME_PATH, state)).toBeNull();
      expect(proGateRedirect('/dashboard-pro/invitation/abc', state)).toBeNull();
    }
  });

  it('leaves the client app alone', () => {
    expect(isProGatedPath('/map')).toBe(false);
    expect(isProGatedPath('/profile')).toBe(false);
    expect(isProGatedPath('/dashboard-proxy')).toBe(false);
  });
});

describe('parseProAccessStatus', () => {
  it('reads the RPC answer', () => {
    const s = parseProAccessStatus({
      state: 'welcome',
      welcome: { claim_id: 'c1', place_id: 'p1', place_name: 'Bloom' },
      pending: null,
    });
    expect(s.state).toBe('welcome');
    expect(s.welcome).toEqual({ claimId: 'c1', placeId: 'p1', placeName: 'Bloom' });
    expect(s.pending).toBeNull();
  });

  it('falls back to none on anything unexpected', () => {
    expect(parseProAccessStatus(null).state).toBe('none');
    expect(parseProAccessStatus({ state: 'admin' }).state).toBe('none');
  });
});

describe('destinationAfterAuth with a café request under review', () => {
  const pending = { isPro: false, onboardingCompleted: false, proState: 'pending' as const };

  it('brings the gérant back to the waiting screen after signing in again', () => {
    expect(destinationAfterAuth(pending, '/')).toBe(PRO_WAITING_PATH);
    expect(destinationAfterAuth(pending, '/map')).toBe(PRO_WAITING_PATH);
    expect(destinationAfterAuth(pending, '/dashboard-pro')).toBe(PRO_WAITING_PATH);
  });

  it('keeps a precise page that was asked for', () => {
    expect(destinationAfterAuth(pending, '/place/abc')).toBe(
      '/onboarding?next=%2Fplace%2Fabc'
    );
  });
});
