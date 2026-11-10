-- Security audit of 2026-11-10: fixes that only touch the main app.
--
-- 1. places: ownership / review columns are no longer writable from the app.
--    An owner could set `vendor_id` to any user id, which (through
--    places_sync_owner_member) made that user an owner of the café without
--    their consent. Ownership only changes through the claim / team functions.
-- 2. log_place_event: only signed-in visitors are counted. The visitor id used
--    to come from the browser (`p_anon_id`), so anyone could inflate the views
--    shown in the Pro statistics by sending random ids.
--
-- Nothing is dropped or renamed: function signatures and columns are unchanged.

-- ---------------------------------------------------------------------------
-- 1. places: read-only ownership / review columns for API roles
-- ---------------------------------------------------------------------------
create or replace function public.places_protect_ownership_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Server-side code (SECURITY DEFINER functions, admin SQL) is not concerned.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.vendor_id is distinct from old.vendor_id then
    raise exception 'places: vendor_id is read-only'
      using errcode = 'check_violation';
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'places: owner_id is read-only'
      using errcode = 'check_violation';
  end if;

  if new.suggested_by is distinct from old.suggested_by then
    raise exception 'places: suggested_by is read-only'
      using errcode = 'check_violation';
  end if;

  if new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'places: review columns are read-only'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.places_protect_ownership_columns() is
  'Blocks app roles from changing who owns, suggested or reviewed a café. Same pattern as places_protect_verification_status.';

revoke all on function public.places_protect_ownership_columns() from public, anon, authenticated;

drop trigger if exists places_protect_ownership_columns on public.places;
create trigger places_protect_ownership_columns
  before update on public.places
  for each row
  execute function public.places_protect_ownership_columns();

-- ---------------------------------------------------------------------------
-- 2. log_place_event: signed-in visitors only
-- ---------------------------------------------------------------------------
-- `p_anon_id` stays in the signature so older app versions still installed on
-- phones keep calling without an error; its value is ignored.
create or replace function public.log_place_event(
  p_place uuid,
  p_kind text,
  p_source text default null,
  p_anon_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_day date := (now() at time zone 'Europe/Paris')::date;
begin
  -- The visitor comes from the session only, never from the client.
  if v_uid is null then
    return;
  end if;

  if p_place is null or not exists (select 1 from public.places where id = p_place) then
    return;
  end if;

  -- Café team looking at their own sheet must not inflate the numbers.
  if exists (
    select 1 from public.place_members m
    where m.place_id = p_place and m.user_id = v_uid
  ) then
    return;
  end if;

  if p_kind is null or p_kind not in ('view', 'directions') then
    raise exception 'invalid_kind';
  end if;

  if p_source is not null and p_source not in ('map', 'list', 'top', 'drop', 'direct') then
    raise exception 'invalid_source';
  end if;

  v_hash := encode(extensions.digest(convert_to(v_uid::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.place_events (place_id, kind, source, viewer_hash, day)
  values (p_place, p_kind, p_source, v_hash, v_day)
  on conflict (place_id, kind, viewer_hash, day) do nothing;
end;
$$;

comment on function public.log_place_event(uuid, text, text, uuid) is
  'Records at most one view/directions event per signed-in visitor, café and Paris day. Ignores visitors without a session, missing places and place members. p_anon_id is ignored (kept for older clients).';

-- Still callable without a session (older clients), but it then does nothing.
revoke all on function public.log_place_event(uuid, text, text, uuid) from public;
grant execute on function public.log_place_event(uuid, text, text, uuid) to anon, authenticated;
