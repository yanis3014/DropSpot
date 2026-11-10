import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/auth/redirect';

describe('safeRedirectPath', () => {
  it('keeps same-site paths, with their query and hash', () => {
    expect(safeRedirectPath('/dashboard-pro')).toBe('/dashboard-pro');
    expect(safeRedirectPath('/place/abc?from=map#drops')).toBe(
      '/place/abc?from=map#drops'
    );
    expect(safeRedirectPath('/dashboard-pro/invitation/tok_123')).toBe(
      '/dashboard-pro/invitation/tok_123'
    );
  });

  it('falls back to / when nothing usable is given', () => {
    expect(safeRedirectPath(null)).toBe('/');
    expect(safeRedirectPath(undefined)).toBe('/');
    expect(safeRedirectPath('')).toBe('/');
    expect(safeRedirectPath('map')).toBe('/');
  });

  it('refuses absolute and protocol-relative URLs', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/');
    expect(safeRedirectPath('//evil.example')).toBe('/');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
  });

  it('refuses backslash tricks that browsers read as //', () => {
    const backslash = String.fromCharCode(92);
    expect(safeRedirectPath(`/${backslash}evil.example`)).toBe('/');
    expect(safeRedirectPath(`/${backslash}/evil.example`)).toBe('/');
    expect(safeRedirectPath(`/map${backslash}evil`)).toBe('/');
  });

  it('refuses tabs and new lines that browsers strip from URLs', () => {
    expect(safeRedirectPath('/\t/evil.example')).toBe('/');
    expect(safeRedirectPath('/\n/evil.example')).toBe('/');
    expect(safeRedirectPath('/\r/evil.example')).toBe('/');
  });
});
