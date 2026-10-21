import { supabase } from '@/lib/supabase/client';

export type VendorPlanId = 'free' | 'pro';

export interface VendorPlanState {
  plan: VendorPlanId;
  proUntil: string | null;
  hasPro: boolean;
}

const DEFAULT_PLAN: VendorPlanState = {
  plan: 'free',
  proUntil: null,
  hasPro: false,
};

export async function getMyVendorPlan(): Promise<VendorPlanState> {
  if (!supabase) return DEFAULT_PLAN;

  const { data, error } = await supabase.rpc('my_vendor_plan');
  if (error) {
    console.error('my_vendor_plan error:', error);
    return DEFAULT_PLAN;
  }

  const row = data as {
    ok?: boolean;
    plan?: VendorPlanId;
    pro_until?: string | null;
    has_pro?: boolean;
  } | null;

  if (!row?.ok) return DEFAULT_PLAN;

  return {
    plan: row.plan === 'pro' ? 'pro' : 'free',
    proUntil: row.pro_until ?? null,
    hasPro: Boolean(row.has_pro),
  };
}

/** Maps Supabase/Postgres pro errors to a stable client code. */
export function isProRequiredError(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('pro_required') || m.includes('pro required');
}
