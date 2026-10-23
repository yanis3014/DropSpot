-- Admin console without the service-role key.
-- 1) Admins (with the 6-digit code) can read claim proofs, so the app signs
--    the link with the admin's own session.
-- 2) Suspending an account goes through an admin RPC instead of the Auth
--    admin API.

-- ---------------------------------------------------------------------------
-- 1) Claim proofs readable by admins
-- ---------------------------------------------------------------------------
drop policy if exists "Admins read claim proofs" on storage.objects;
create policy "Admins read claim proofs"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'claim-proofs' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 2) Suspend / reactivate an account
-- ---------------------------------------------------------------------------
-- Supabase Auth refuses sign-in and token refresh while banned_until is in
-- the future.
create or replace function public.admin_set_user_suspended(
  p_user uuid,
  p_suspended boolean,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_email text;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_user = auth.uid() then
    return json_build_object('ok', false, 'error', 'self');
  end if;
  if exists (select 1 from public.admins a where a.user_id = p_user) then
    return json_build_object('ok', false, 'error', 'target_admin');
  end if;
  if p_suspended and coalesce(length(v_note), 0) < 3 then
    return json_build_object('ok', false, 'error', 'note_required');
  end if;

  update auth.users u
     set banned_until = case when p_suspended then now() + interval '100 years' else null end,
         updated_at = now()
   where u.id = p_user
  returning u.email into v_email;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  perform public.log_admin_action(
    case when p_suspended then 'suspend_user' else 'unsuspend_user' end,
    'user', p_user, v_email, '{}'::jsonb, v_note
  );
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_set_user_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;

-- The log-only helper is replaced by the function above.
drop function if exists public.admin_log_user_action(text, uuid, text);
