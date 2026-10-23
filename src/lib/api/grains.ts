import { supabase } from '@/lib/supabase/client';

export interface MyGrains {
  balance: number;
  /** Grains earned over time; levels and priority use it. */
  lifetime: number;
  /** Reserved places on limited drops. */
  priority: boolean;
}

/** Balance, lifetime earnings and status of the signed-in user. */
export async function getMyGrains(): Promise<MyGrains | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_grains');
  if (error) {
    console.error('Error fetching my grains:', error);
    return null;
  }
  if (!data) return null;
  const row = data as Partial<MyGrains>;
  return {
    balance: Number(row.balance ?? 0),
    lifetime: Number(row.lifetime ?? 0),
    priority: Boolean(row.priority),
  };
}
