import { supabase } from '@/lib/supabase/client';

/** Browser check: is the signed-in user listed in `admins` (any MFA level)? */
export async function fetchIsAdminMember(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_admin_member');
  if (error) {
    // Before the admin console migration, the function does not exist yet.
    return false;
  }
  return Boolean(data);
}
