-- Harden flash drops: no Grains on counter validation, server-enforced
-- grains_reward / PIN / dates, and stricter INSERT/UPDATE RLS.
-- Does not change ERP-facing validate_flash_drop_code(text, uuid) signature.

-- ---------------------------------------------------------------------------
-- 1) validate_flash_drop_code: never credit Grains (p_user_id ignored for credit)
-- ---------------------------------------------------------------------------
create or replace function public.validate_flash_drop_code(
  p_code text,
  p_user_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor uuid := auth.uid();
  v_code text := trim(p_code);
  v_drop public.flash_drops%rowtype;
  v_redemption_id uuid;
begin
  if v_vendor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_code is null or length(v_code) < 4 then
    return json_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Accepte "1234" ou payload QR type dropspot:1234 / {"code":"1234"}
  if v_code ~* 'dropspot[:/-]' then
    v_code := regexp_replace(v_code, '.*dropspot[:/-]', '', 'i');
  end if;
  if v_code like '{%' then
    begin
      v_code := v_code::json ->> 'code';
    exception when others then
      null;
    end;
  end if;
  v_code := regexp_replace(v_code, '[^0-9A-Za-z]', '', 'g');

  select * into v_drop
  from public.flash_drops
  where vendor_id = v_vendor
    and pin_code = v_code
    and is_active = true
    and ends_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'code_not_found');
  end if;

  if v_drop.max_uses is not null and v_drop.current_uses >= v_drop.max_uses then
    return json_build_object('ok', false, 'error', 'sold_out');
  end if;

  update public.flash_drops
  set current_uses = current_uses + 1,
      updated_at = now()
  where id = v_drop.id;

  -- p_user_id is kept for ERP / ledger linkage only.
  -- Grains at the counter return with per-client codes (phase 2d).
  insert into public.flash_drop_redemptions (
    flash_drop_id, vendor_id, user_id, validation_code, grains_awarded
  )
  values (
    v_drop.id, v_vendor, p_user_id, v_code, 0
  )
  returning id into v_redemption_id;

  return json_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'flash_drop_id', v_drop.id,
    'title', v_drop.title,
    'grains_awarded', 0,
    'current_uses', v_drop.current_uses + 1,
    'user_credited', false
  );
end;
$$;

revoke all on function public.validate_flash_drop_code(text, uuid) from public;
grant execute on function public.validate_flash_drop_code(text, uuid) to authenticated;

comment on function public.validate_flash_drop_code(text, uuid) is
  'Counter PIN validation. Never credits profiles.grains_balance; p_user_id ignored for credit (ERP signature kept). user_credited always false until per-client codes (2d).';

-- ---------------------------------------------------------------------------
-- 2) BEFORE INSERT OR UPDATE guard (authenticated / anon only)
-- ---------------------------------------------------------------------------
create or replace function public.flash_drops_enforce_client_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  -- Fixed Grains reward until per-client redemption codes (phase 2d).
  c_default_grains_reward constant integer := 10;
  v_pin text;
  v_attempt integer := 0;
begin
  -- Bypass for service_role / postgres / migrations / ERP jobs.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.grains_reward := c_default_grains_reward;

  if new.max_uses is not null and new.max_uses <= 0 then
    raise exception 'flash_drops: max_uses must be null or > 0'
      using errcode = 'check_violation';
  end if;

  if new.ends_at <= new.starts_at then
    raise exception 'flash_drops: ends_at must be after starts_at'
      using errcode = 'check_violation';
  end if;

  if new.pin_code is null or btrim(new.pin_code) = '' then
    loop
      v_attempt := v_attempt + 1;
      if v_attempt > 40 then
        raise exception 'flash_drops: could not allocate unique pin_code'
          using errcode = 'unique_violation';
      end if;

      v_pin := lpad((floor(random() * 10000))::integer::text, 4, '0');

      exit when not exists (
        select 1
        from public.flash_drops fd
        where fd.vendor_id = new.vendor_id
          and fd.pin_code = v_pin
          and fd.is_active = true
          and fd.id is distinct from new.id
      );
    end loop;

    new.pin_code := v_pin;
  end if;

  return new;
end;
$$;

drop trigger if exists flash_drops_enforce_client_insert on public.flash_drops;
create trigger flash_drops_enforce_client_insert
  before insert or update on public.flash_drops
  for each row
  execute function public.flash_drops_enforce_client_insert();

comment on function public.flash_drops_enforce_client_insert() is
  'Client-role guard: force grains_reward=10, reject bad max_uses/dates, mint pin_code if missing. Skipped when current_user not in (authenticated, anon).';

-- ---------------------------------------------------------------------------
-- 3) Stricter INSERT / UPDATE policies
-- ---------------------------------------------------------------------------
drop policy if exists "Vendors insert own flash drops" on public.flash_drops;
create policy "Vendors insert own flash drops"
  on public.flash_drops for insert
  with check (
    auth.uid() = vendor_id
    and exists (
      select 1
      from public.places p
      where p.id = place_id
        and p.vendor_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role in ('vendor', 'owner')
    )
  );

drop policy if exists "Vendors update own flash drops" on public.flash_drops;
create policy "Vendors update own flash drops"
  on public.flash_drops for update
  using (
    auth.uid() = vendor_id
    and exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role in ('vendor', 'owner')
    )
  )
  with check (
    auth.uid() = vendor_id
    and exists (
      select 1
      from public.places p
      where p.id = place_id
        and p.vendor_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role in ('vendor', 'owner')
    )
  );

-- Helpful for RLS place ownership checks (idempotent with earlier migration).
create index if not exists places_vendor_id_idx on public.places (vendor_id);
