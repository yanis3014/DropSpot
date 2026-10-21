-- Realtime: journal validations accueil pro (postgres_changes sur drop_codes).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'drop_codes'
  ) then
    alter publication supabase_realtime add table public.drop_codes;
  end if;
end $$;
