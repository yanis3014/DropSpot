import { describe, expect, it } from 'vitest';
import { distanceMeters, formatDistance } from '@/lib/geo';
import {
  destinationForProfile,
  isVendorRole,
  safeRedirectPath,
} from '@/lib/auth/redirect';

describe('distanceMeters (Haversine)', () => {
  it('retourne 0 pour le même point', () => {
    const p = { lat: 43.7102, lng: 7.262 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it('calcule ~111 km pour 1° de latitude', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 1, lng: 0 };
    const d = distanceMeters(a, b);
    // 1° lat ≈ 111 195 m
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });

  it('détecte une proximité check-in (< 100 m) à Nice', () => {
    const cafe = { lat: 43.7102, lng: 7.262 };
    // ~50 m vers le nord (≈ 0.00045°)
    const nearby = { lat: 43.71065, lng: 7.262 };
    const d = distanceMeters(cafe, nearby);
    expect(d).toBeLessThan(100);
  });

  it('détecte un spot trop loin (> 100 m)', () => {
    const cafe = { lat: 43.7102, lng: 7.262 };
    const far = { lat: 43.712, lng: 7.262 }; // ~200 m
    expect(distanceMeters(cafe, far)).toBeGreaterThan(100);
  });
});

describe('formatDistance', () => {
  it('affiche les mètres sous 1 km', () => {
    expect(formatDistance(85)).toBe('85 m');
  });

  it('affiche les km au-delà', () => {
    expect(formatDistance(2500)).toBe('2,5 km');
  });
});

describe('redirection selon le rôle', () => {
  it('isVendorRole reconnaît vendor et owner', () => {
    expect(isVendorRole('vendor')).toBe(true);
    expect(isVendorRole('owner')).toBe(true);
    expect(isVendorRole('user')).toBe(false);
    expect(isVendorRole(null)).toBe(false);
  });

  it('vendor → /dashboard-pro', () => {
    expect(
      destinationForProfile({
        role: 'vendor',
        onboarding_completed_at: '2026-01-01',
      })
    ).toBe('/dashboard-pro');
  });

  it('owner → /dashboard-pro', () => {
    expect(destinationForProfile({ role: 'owner' })).toBe('/dashboard-pro');
  });

  it('user onboardé → / (ou redirect préféré)', () => {
    expect(
      destinationForProfile({
        role: 'user',
        onboarding_completed_at: '2026-01-01',
      })
    ).toBe('/');

    expect(
      destinationForProfile(
        { role: 'user', onboarding_completed_at: '2026-01-01' },
        '/check-in'
      )
    ).toBe('/check-in');
  });

  it('user sans onboarding → /onboarding', () => {
    expect(destinationForProfile({ role: 'user' })).toBe('/onboarding');
  });

  it('safeRedirectPath bloque les open redirects', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/');
    expect(safeRedirectPath('//evil.com')).toBe('/');
    expect(safeRedirectPath('/map')).toBe('/map');
  });
});
