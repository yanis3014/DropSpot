"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin/assertAdmin";

type ActionResult = { ok: true } | { ok: false; error: string };

const PLACE_ERRORS: Record<string, string> = {
  invalid_name: "Le nom doit faire entre 2 et 120 caractères.",
  invalid_address: "L'adresse doit faire entre 3 et 200 caractères.",
  not_found: "Ce café n'existe plus.",
  not_found_or_done: "Ce café a déjà été validé.",
  forbidden: "Accès admin requis.",
};

function rpcResult(data: unknown, error: { message: string } | null): ActionResult {
  if (error) return { ok: false, error: error.message };
  const res = data as { ok?: boolean; error?: string } | null;
  if (!res?.ok) {
    const code = res?.error ?? "unknown";
    return { ok: false, error: PLACE_ERRORS[code] ?? code };
  }
  return { ok: true };
}

export async function updatePlaceAction(input: {
  placeId: string;
  name: string;
  address: string;
  city: string;
}): Promise<ActionResult> {
  const gate = await assertAdmin();
  if (!gate.ok) return gate;
  const { data, error } = await gate.supabase.rpc("admin_update_place", {
    p_place: input.placeId,
    p_name: input.name,
    p_address: input.address,
    p_city: input.city,
  });
  const result = rpcResult(data, error);
  if (result.ok) revalidatePath("/admin/cafes");
  return result;
}

export async function markPlaceReviewedAction(placeId: string): Promise<ActionResult> {
  const gate = await assertAdmin();
  if (!gate.ok) return gate;
  const { data, error } = await gate.supabase.rpc("admin_mark_place_reviewed", {
    p_place: placeId,
  });
  const result = rpcResult(data, error);
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/cafes");
  }
  return result;
}

/**
 * Pro plan. `proUntil` is a YYYY-MM-DD day (end of that day, Paris) or empty
 * for no end date.
 */
export async function setVendorPlanAction(input: {
  userId: string;
  plan: "free" | "pro";
  proUntil: string;
}): Promise<ActionResult> {
  const gate = await assertAdmin();
  if (!gate.ok) return gate;

  let proUntil: string | null = null;
  if (input.plan === "pro" && input.proUntil) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.proUntil)) {
      return { ok: false, error: "Date de fin invalide." };
    }
    proUntil = `${input.proUntil}T23:59:59+01:00`;
    if (new Date(proUntil).getTime() <= Date.now()) {
      return { ok: false, error: "La date de fin doit être dans le futur." };
    }
  }

  const { data, error } = await gate.supabase.rpc("admin_set_vendor_plan", {
    p_user: input.userId,
    p_plan: input.plan,
    p_pro_until: proUntil,
  });
  const result = rpcResult(data, error);
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/abonnements");
    revalidatePath(`/admin/utilisateurs/${input.userId}`);
  }
  return result;
}

const SUSPEND_ERRORS: Record<string, string> = {
  self: "Tu ne peux pas suspendre ton propre compte.",
  target_admin: "Un compte admin ne peut pas être suspendu d'ici.",
  note_required: "Indique le motif de la suspension.",
  not_found: "Compte introuvable.",
  forbidden: "Accès admin requis.",
};

/**
 * Suspends or reactivates an account: Supabase Auth then refuses sign-in and
 * token refresh. The RPC also writes the decision to the admin log.
 */
export async function setUserSuspendedAction(input: {
  userId: string;
  suspended: boolean;
  note: string;
}): Promise<ActionResult> {
  const gate = await assertAdmin();
  if (!gate.ok) return gate;

  const { data, error } = await gate.supabase.rpc("admin_set_user_suspended", {
    p_user: input.userId,
    p_suspended: input.suspended,
    p_note: input.note.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok?: boolean; error?: string } | null;
  if (!res?.ok) {
    const code = res?.error ?? "unknown";
    return { ok: false, error: SUSPEND_ERRORS[code] ?? code };
  }

  revalidatePath("/admin/utilisateurs");
  revalidatePath(`/admin/utilisateurs/${input.userId}`);
  return { ok: true };
}
