import { describe, expect, it } from 'vitest';
import { destinationAfterAuth } from '@/lib/auth/redirect';

const admin = { isPro: false, onboardingCompleted: true, isAdmin: true };

describe('destinationAfterAuth for admins', () => {
  it('sends an admin to the console from a vague page', () => {
    expect(destinationAfterAuth(admin, '/')).toBe('/admin');
    expect(destinationAfterAuth(admin, '/login')).toBe('/admin');
    expect(destinationAfterAuth(admin, '/map')).toBe('/admin');
  });

  it('keeps the admin page that was asked for', () => {
    expect(destinationAfterAuth(admin, '/admin/revendications')).toBe(
      '/admin/revendications'
    );
  });

  it('wins over the pro dashboard and the client onboarding', () => {
    expect(
      destinationAfterAuth({ isPro: true, onboardingCompleted: false, isAdmin: true }, '/')
    ).toBe('/admin');
  });

  it('keeps a precise page, such as a café', () => {
    expect(destinationAfterAuth(admin, '/place/abc')).toBe('/place/abc');
  });

  it('never sends a non-admin to the console', () => {
    expect(
      destinationAfterAuth({ isPro: true, onboardingCompleted: true }, '/')
    ).toBe('/dashboard-pro');
    expect(
      destinationAfterAuth({ isPro: false, onboardingCompleted: true }, '/')
    ).toBe('/');
  });
});
