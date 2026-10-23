import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearProIntent,
  hasProIntent,
  PRO_CLAIM_PATH,
  PRO_INTENT_KEY,
  withProIntent,
  writeProIntent,
} from '@/lib/auth/proIntent';

describe('withProIntent', () => {
  it('keeps the destination without intent', () => {
    expect(withProIntent('/', false)).toBe('/');
    expect(withProIntent('/profile', false)).toBe('/profile');
  });

  it('turns a vague destination into the claim wizard', () => {
    for (const path of ['/', '/map', '/login', '/onboarding', '/onboarding?next=%2Fmap']) {
      expect(withProIntent(path, true)).toBe(PRO_CLAIM_PATH);
    }
  });

  it('keeps a precise destination even with intent', () => {
    expect(withProIntent('/dashboard-pro/invitation/abc', true)).toBe(
      '/dashboard-pro/invitation/abc'
    );
    expect(withProIntent('/place/42', true)).toBe('/place/42');
  });
});

describe('pro intent storage', () => {
  afterEach(() => {
    clearProIntent();
    vi.useRealTimers();
  });

  it('is remembered, then cleared', () => {
    expect(hasProIntent()).toBe(false);
    writeProIntent();
    expect(hasProIntent()).toBe(true);
    clearProIntent();
    expect(hasProIntent()).toBe(false);
  });

  it('expires after a day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T08:00:00Z'));
    writeProIntent();
    vi.setSystemTime(new Date('2026-10-24T09:00:00Z'));
    expect(hasProIntent()).toBe(false);
    expect(localStorage.getItem(PRO_INTENT_KEY)).toBeNull();
  });
});
