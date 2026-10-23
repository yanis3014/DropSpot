"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "not_authenticated" };
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return { ok: false as const, error: "forbidden" };
  }
  return { ok: true as const, supabase };
}

export async function approveClaimAction(claimId: string, note?: string) {
  const gate = await assertAdmin();
  if (!gate.ok) return gate;

  const { data, error } = await gate.supabase.rpc("approve_claim", {
    p_claim_id: claimId,
    p_note: note?.trim() || null,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/admin/revendications");
  return { ok: true as const, data };
}

export async function rejectClaimAction(claimId: string, note?: string) {
  const gate = await assertAdmin();
  if (!gate.ok) return gate;

  const { data, error } = await gate.supabase.rpc("reject_claim", {
    p_claim_id: claimId,
    p_note: note?.trim() || null,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/admin/revendications");
  return { ok: true as const, data };
}

export async function getClaimProofSignedUrlAction(claimId: string) {
  const gate = await assertAdmin();
  if (!gate.ok) return gate;

  const { data: claim, error } = await gate.supabase
    .from("place_claims")
    .select("proof_path")
    .eq("id", claimId)
    .maybeSingle();

  if (error || !claim?.proof_path) {
    return { ok: false as const, error: "proof_not_found" };
  }

  // Signed with the admin's own session: the storage policy lets admins
  // (with the 6-digit code) read claim proofs.
  const { data: signed, error: signError } = await gate.supabase.storage
    .from("claim-proofs")
    .createSignedUrl(claim.proof_path, 3600);

  if (signError || !signed?.signedUrl) {
    return { ok: false as const, error: signError?.message ?? "sign_failed" };
  }

  return { ok: true as const, url: signed.signedUrl };
}
