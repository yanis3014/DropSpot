import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_HOME = "/admin";
export const ADMIN_SECURITY_PATH = "/admin/securite";

/**
 * Signed-in user listed in `admins`, whatever their MFA level.
 * Only for the 6-digit code pages; everything else uses `requireAdmin()`.
 */
export async function requireAdminMember(returnTo: string = ADMIN_HOME) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }

  const { data: isMember, error } = await supabase.rpc("is_admin_member");
  if (error || !isMember) {
    redirect("/");
  }

  return { supabase, user };
}

/**
 * Admin who verified their 6-digit code in this session (aal2).
 * Without the code, sends them to set it up or type it.
 * The database checks the same thing again in `is_admin()`.
 */
export async function requireAdmin(returnTo: string = ADMIN_HOME) {
  const { supabase, user } = await requireAdminMember(returnTo);

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    redirect(
      `${ADMIN_SECURITY_PATH}?redirect=${encodeURIComponent(returnTo)}`
    );
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) {
    redirect(
      `${ADMIN_SECURITY_PATH}?redirect=${encodeURIComponent(returnTo)}`
    );
  }

  return { supabase, user };
}
