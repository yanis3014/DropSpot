import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearProIntent,
  PRO_CLAIM_QUERY_KEY,
  PRO_INTENT_KEY,
  readProClaimQuery,
  writeProClaimQuery,
} from '@/lib/auth/proIntent';

describe('pro claim query storage', () => {
  afterEach(() => {
    clearProIntent();
    vi.useRealTimers();
  });

  it('remembers the cafe name with the intent, then clears', () => {
    writeProClaimQuery('Maison Grain');
    // Writing the query also writes the claim intent.
    expect(localStorage.getItem(PRO_INTENT_KEY)).not.toBeNull();
    expect(readProClaimQuery()).toBe('Maison Grain');
    clearProIntent();
    expect(readProClaimQuery()).toBeNull();
  });

  it('truncates the name at 80 characters', () => {
    writeProClaimQuery('x'.repeat(120));
    expect(readProClaimQuery()).toHaveLength(80);
  });

  it('forgets a value older than a day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T08:00:00Z'));
    writeProClaimQuery('Maison Grain');
    vi.setSystemTime(new Date('2026-10-24T09:00:00Z'));
    expect(readProClaimQuery()).toBeNull();
    expect(localStorage.getItem(PRO_CLAIM_QUERY_KEY)).toBeNull();
  });

  it('forgets invalid JSON', () => {
    localStorage.setItem(PRO_CLAIM_QUERY_KEY, '{oops');
    expect(readProClaimQuery()).toBeNull();
    expect(localStorage.getItem(PRO_CLAIM_QUERY_KEY)).toBeNull();
  });
});
