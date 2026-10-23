import { createClient } from "@/lib/supabase/server";

/** Server actions: admin with the 6-digit code, or a typed error (no redirect). */
export async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Session expirée, reconnecte-toi." };
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return { ok: false as const, error: "Accès admin requis (code à 6 chiffres)." };
  }
  return { ok: true as const, supabase, user };
}
