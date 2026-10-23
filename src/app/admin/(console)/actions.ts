"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createServiceClient } from "@/lib/supabase/service";

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

/** ~100 years: Supabase Auth has no « forever » ban. */
const SUSPEND_DURATION = "876000h";

/**
 * Suspends or reactivates an account in Supabase Auth (blocks sign-in and
 * token refresh), then writes the decision to the admin log.
 */
export async function setUserSuspendedAction(input: {
  userId: string;
  suspended: boolean;
  note: string;
}): Promise<ActionResult> {
  const gate = await assertAdmin();
  if (!gate.ok) return gate;

  const note = input.note.trim();
  if (input.suspended && note.length < 3) {
    return { ok: false, error: "Indique le motif de la suspension." };
  }
  if (input.userId === gate.user.id) {
    return { ok: false, error: "Tu ne peux pas suspendre ton propre compte." };
  }

  const { data: detail, error: detailError } = await gate.supabase.rpc(
    "admin_user_detail",
    { p_user: input.userId }
  );
  if (detailError || !detail) {
    return { ok: false, error: "Compte introuvable." };
  }
  if ((detail as { is_admin?: boolean }).is_admin) {
    return { ok: false, error: "Un compte admin ne peut pas être suspendu d'ici." };
  }

  const service = createServiceClient();
  const { error: banError } = await service.auth.admin.updateUserById(input.userId, {
    ban_duration: input.suspended ? SUSPEND_DURATION : "none",
  });
  if (banError) {
    return { ok: false, error: banError.message };
  }

  const { data, error } = await gate.supabase.rpc("admin_log_user_action", {
    p_action: input.suspended ? "suspend_user" : "unsuspend_user",
    p_user: input.userId,
    p_note: note || null,
  });
  if (error || !(data as { ok?: boolean } | null)?.ok) {
    console.error("admin_log_user_action:", error?.message ?? data);
  }

  revalidatePath("/admin/utilisateurs");
  revalidatePath(`/admin/utilisateurs/${input.userId}`);
  return { ok: true };
}
