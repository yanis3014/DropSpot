import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Redirects to login or home if the session user is not in `admins`. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/revendications");
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) {
    redirect("/");
  }

  return { supabase, user };
}
