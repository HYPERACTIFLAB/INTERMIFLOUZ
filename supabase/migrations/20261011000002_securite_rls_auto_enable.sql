-- La fonction rls_auto_enable (créée par l'option « Enable automatic RLS » du tableau de bord)
-- ne doit pas être appelable via l'API. Sans effet si la fonction n'existe pas.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
