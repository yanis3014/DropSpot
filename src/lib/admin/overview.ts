import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminOverview = {
  pending_claims: number;
  places_to_review: number;
  places_total: number;
  places_verified: number;
  pros_active: number;
};

const EMPTY: AdminOverview = {
  pending_claims: 0,
  places_to_review: 0,
  places_total: 0,
  places_verified: 0,
  pros_active: 0,
};

/** Console counters (admin_overview RPC, admin + 6-digit code only). */
export async function fetchAdminOverview(
  supabase: SupabaseClient
): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc("admin_overview");
  if (error || !data) {
    if (error) console.error("admin_overview:", error.message);
    return EMPTY;
  }
  const raw = data as Partial<Record<keyof AdminOverview, unknown>>;
  return {
    pending_claims: Number(raw.pending_claims) || 0,
    places_to_review: Number(raw.places_to_review) || 0,
    places_total: Number(raw.places_total) || 0,
    places_verified: Number(raw.places_verified) || 0,
    pros_active: Number(raw.pros_active) || 0,
  };
}
