-- Validation caisse : PIN, compteurs, redemptions, grains profil

alter table public.flash_drops
  add column if not exists pin_code text,
  add column if not exists current_uses integer not null default 0,
  add column if not exists max_uses integer,
  add column if not exists grains_reward integer not null default 10;

-- PIN unique parmi les drops encore actifs d'un même vendor
create unique index if not exists flash_drops_vendor_active_pin_uidx
  on public.flash_drops (vendor_id, pin_code)
  where is_active = true and pin_code is not null;

alter table public.profiles
  add column if not exists grains_balance integer not null default 0;

alter table public.places
  add column if not exists plugs_level text;

alter table public.places
  drop constraint if exists places_plugs_level_check;

alter table public.places
  add constraint places_plugs_level_check
  check (plugs_level is null or plugs_level in ('limited', 'regular', 'everywhere'));

-- Historique des validations en caisse
create table if not exists public.flash_drop_redemptions (
  id uuid primary key default gen_random_uuid(),
  flash_drop_id uuid not null references public.flash_drops (id) on delete cascade,
  vendor_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  validation_code text not null,
  grains_awarded integer not null default 10,
  created_at timestamptz not null default now()
);

create index if not exists flash_drop_redemptions_vendor_created_idx
  on public.flash_drop_redemptions (vendor_id, created_at desc);

create index if not exists flash_drop_redemptions_drop_idx
  on public.flash_drop_redemptions (flash_drop_id);

alter table public.flash_drop_redemptions enable row level security;

drop policy if exists "Vendors read own redemptions" on public.flash_drop_redemptions;
create policy "Vendors read own redemptions"
  on public.flash_drop_redemptions for select
  using (auth.uid() = vendor_id);

drop policy if exists "Users read own redemptions" on public.flash_drop_redemptions;
create policy "Users read own redemptions"
  on public.flash_drop_redemptions for select
  using (auth.uid() = user_id);

-- Storage bucket photos établissements
insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read place photos" on storage.objects;
create policy "Public read place photos"
  on storage.objects for select
  using (bucket_id = 'place-photos');

drop policy if exists "Vendors upload place photos" on storage.objects;
create policy "Vendors upload place photos"
  on storage.objects for insert
  with check (
    bucket_id = 'place-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Vendors update place photos" on storage.objects;
create policy "Vendors update place photos"
  on storage.objects for update
  using (bucket_id = 'place-photos' and auth.role() = 'authenticated');

drop policy if exists "Vendors delete place photos" on storage.objects;
create policy "Vendors delete place photos"
  on storage.objects for delete
  using (bucket_id = 'place-photos' and auth.role() = 'authenticated');

-- RPC : validation d'un code PIN (ou payload QR) en caisse
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
  v_reward integer;
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

  v_reward := coalesce(v_drop.grains_reward, 10);

  update public.flash_drops
  set current_uses = current_uses + 1,
      updated_at = now()
  where id = v_drop.id;

  insert into public.flash_drop_redemptions (
    flash_drop_id, vendor_id, user_id, validation_code, grains_awarded
  )
  values (
    v_drop.id, v_vendor, p_user_id, v_code, v_reward
  )
  returning id into v_redemption_id;

  if p_user_id is not null then
    update public.profiles
    set grains_balance = coalesce(grains_balance, 0) + v_reward
    where id = p_user_id;
  end if;

  return json_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'flash_drop_id', v_drop.id,
    'title', v_drop.title,
    'grains_awarded', v_reward,
    'current_uses', v_drop.current_uses + 1,
    'user_credited', p_user_id is not null
  );
end;
$$;

revoke all on function public.validate_flash_drop_code(text, uuid) from public;
grant execute on function public.validate_flash_drop_code(text, uuid) to authenticated;

-- Stats du jour pour le dashboard
create or replace function public.vendor_today_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor uuid := auth.uid();
  v_count integer;
  v_grains integer;
begin
  if v_vendor is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select
    count(*)::integer,
    coalesce(sum(grains_awarded), 0)::integer
  into v_count, v_grains
  from public.flash_drop_redemptions
  where vendor_id = v_vendor
    and created_at >= date_trunc('day', now());

  return json_build_object(
    'ok', true,
    'validations_today', v_count,
    'grains_awarded_today', v_grains
  );
end;
$$;

revoke all on function public.vendor_today_stats() from public;
grant execute on function public.vendor_today_stats() to authenticated;
