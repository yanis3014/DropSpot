import { describe, expect, it } from 'vitest';
import {
  cheapestPlanWith,
  DEFAULT_FEATURE_GRID,
  featuresForPlan,
  gridFromRows,
  normalizePlanId,
  normalizePlanList,
  removedPlans,
} from '@/lib/pro/planFeatures';
import { parsePlanRow } from '@/lib/api/vendorPlan';

describe('planFeatures', () => {
  it('maps the old free/pro values', () => {
    expect(normalizePlanId('free')).toBe('presence');
    expect(normalizePlanId('pro')).toBe('premium');
    expect(normalizePlanId('analytics')).toBe('analytics');
    expect(normalizePlanId(undefined)).toBe('presence');
  });

  it('keeps known offers in order, without duplicates', () => {
    expect(normalizePlanList(['premium', 'gold', 'presence', 'premium'])).toEqual([
      'presence',
      'premium',
    ]);
    expect(normalizePlanList(null)).toEqual([]);
  });

  it('locks a feature missing from the table', () => {
    const grid = gridFromRows([{ feature: 'drops', plans: ['premium'] }]);
    expect(grid.drops).toEqual(['premium']);
    expect(grid.gallery_full).toEqual([]);
    expect(cheapestPlanWith('gallery_full', grid)).toBeNull();
  });

  it('starting grid matches the app before the change', () => {
    expect(featuresForPlan('presence', DEFAULT_FEATURE_GRID).sort()).toEqual(
      ['drops', 'team_staff'].sort()
    );
    expect(cheapestPlanWith('stats_insights', DEFAULT_FEATURE_GRID)).toBe('analytics');
    expect(cheapestPlanWith('team_manager', DEFAULT_FEATURE_GRID)).toBe('premium');
  });

  it('lists the offers that lose a feature', () => {
    expect(removedPlans(['analytics', 'premium'], ['premium'])).toEqual(['analytics']);
  });
});

describe('parsePlanRow', () => {
  it('reads the new payload', () => {
    const s = parsePlanRow({
      ok: true,
      plan: 'analytics',
      pro_until: null,
      has_pro: true,
      effective_plan: 'analytics',
      features: ['stats_history', 'nope'],
    });
    expect(s.effectivePlan).toBe('analytics');
    expect(s.features).toEqual(['stats_history']);
  });

  it('falls back on the old free/pro payload (SQL not pasted yet)', () => {
    const s = parsePlanRow({ ok: true, plan: 'pro', pro_until: null, has_pro: true });
    expect(s.effectivePlan).toBe('premium');
    expect(s.features).toContain('gallery_full');
    const expired = parsePlanRow({ ok: true, plan: 'pro', has_pro: false });
    expect(expired.effectivePlan).toBe('presence');
  });
});
