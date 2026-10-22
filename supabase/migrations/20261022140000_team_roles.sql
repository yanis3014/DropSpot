-- Team RPCs: list_place_team, set_member_role, leave_place, cancel_invitation.
-- Does not change profiles RLS.

-- ---------------------------------------------------------------------------
-- 1) list_place_team — roster for co-members (email only for owners)
-- ---------------------------------------------------------------------------
create or replace function public.list_place_team(p_place_id uuid)
returns table (
  user_id uuid,
  role text,
  full_name text,
  email text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    m.role::text,
    pr.full_name,
    case
      when public.has_place_role(p_place_id, array['owner'])
        then u.email::text
      else null
    end as email,
    m.created_at as joined_at
  from public.place_members m
  left join public.profiles pr on pr.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.place_id = p_place_id
    and public.has_place_role(
      p_place_id,
      array['owner', 'manager', 'staff']
    );
$$;

comment on function public.list_place_team(uuid) is
  'Co-members of a café. Email only when caller is owner. Empty if not a member.';

revoke all on function public.list_place_team(uuid) from public, anon;
grant execute on function public.list_place_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) set_member_role
-- ---------------------------------------------------------------------------
create or replace function public.set_member_role(
  p_place_id uuid,
  p_user_id uuid,
  p_role text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_current text;
  v_owner_count integer;
  v_vendor uuid;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not public.has_place_role(p_place_id, array['owner']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_role is null or p_role not in ('owner', 'manager', 'staff') then
    return json_build_object('ok', false, 'error', 'invalid_role');
  end if;

  select m.role into v_current
  from public.place_members m
  where m.place_id = p_place_id
    and m.user_id = p_user_id;

  if v_current is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_current = p_role then
    return json_build_object('ok', true, 'role', p_role);
  end if;

  -- Never leave the café without an owner
  if v_current = 'owner' and p_role is distinct from 'owner' then
    select count(*)::integer into v_owner_count
    from public.place_members m
    where m.place_id = p_place_id
      and m.role = 'owner';

    if v_owner_count <= 1 then
      return json_build_object('ok', false, 'error', 'last_owner');
    end if;
  end if;

  if p_role = 'manager' then
    v_vendor := public.place_vendor_id(p_place_id);
    if not public.has_pro(v_vendor) then
      return json_build_object('ok', false, 'error', 'pro_required');
    end if;
  end if;

  update public.place_members
  set role = p_role
  where place_id = p_place_id
    and user_id = p_user_id;

  return json_build_object('ok', true, 'role', p_role);
end;
$$;

comment on function public.set_member_role(uuid, uuid, text) is
  'Owner-only role change. Blocks last-owner demotion; manager requires Pro.';

revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) leave_place
-- ---------------------------------------------------------------------------
create or replace function public.leave_place(p_place_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_owner_count integer;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select m.role into v_role
  from public.place_members m
  where m.place_id = p_place_id
    and m.user_id = v_actor;

  if v_role is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_role = 'owner' then
    select count(*)::integer into v_owner_count
    from public.place_members m
    where m.place_id = p_place_id
      and m.role = 'owner';

    if v_owner_count <= 1 then
      return json_build_object('ok', false, 'error', 'last_owner');
    end if;
  end if;

  delete from public.place_members
  where place_id = p_place_id
    and user_id = v_actor;

  return json_build_object('ok', true);
end;
$$;

comment on function public.leave_place(uuid) is
  'Member leaves a café. Refuses if they are the last owner.';

revoke all on function public.leave_place(uuid) from public, anon;
grant execute on function public.leave_place(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) cancel_invitation
-- ---------------------------------------------------------------------------
create or replace function public.cancel_invitation(p_invitation_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_place uuid;
  v_accepted timestamptz;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select i.place_id, i.accepted_at
  into v_place, v_accepted
  from public.place_invitations i
  where i.id = p_invitation_id;

  if v_place is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.has_place_role(v_place, array['owner']) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_accepted is not null then
    return json_build_object('ok', false, 'error', 'already_accepted');
  end if;

  delete from public.place_invitations
  where id = p_invitation_id
    and accepted_at is null;

  return json_build_object('ok', true);
end;
$$;

comment on function public.cancel_invitation(uuid) is
  'Owner-only. Cancels a pending (not yet accepted) invitation.';

revoke all on function public.cancel_invitation(uuid) from public, anon;
grant execute on function public.cancel_invitation(uuid) to authenticated;
