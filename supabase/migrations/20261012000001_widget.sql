-- Widget iPhone (Scriptable) : une clé perso permet de lire les chiffres clés sans session.

create table public.cles_widget (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Empreinte SHA-256 de la clé : la clé elle-même n'est jamais stockée.
  cle_hash text not null unique,
  cree_le timestamptz not null default now(),
  utilise_le timestamptz
);

alter table public.cles_widget enable row level security;
create policy "proprietaire" on public.cles_widget for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Données brutes du widget pour la clé donnée (null si la clé est inconnue).
-- « security definer » : le widget n'a pas de session, la clé sert d'identification.
create function public.donnees_widget(p_cle text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if p_cle is null or length(p_cle) < 32 then
    return null;
  end if;

  update public.cles_widget
     set utilise_le = now()
   where cle_hash = encode(extensions.digest(p_cle, 'sha256'), 'hex')
  returning user_id into v_user;

  if v_user is null then
    return null;
  end if;

  return json_build_object(
    'contrats', (
      select coalesce(json_agg(json_build_object(
        'id', c.id,
        'date_debut', c.date_debut,
        'date_fin', c.date_fin,
        'heures', c.heures,
        'cachets', c.cachets,
        'salaire_brut', c.salaire_brut,
        'salaire_net', c.salaire_net,
        'paye', c.paye,
        'statut_aem', c.statut_aem,
        'jours_travailles', c.jours_travailles,
        'poste', c.poste,
        'annexe', c.annexe,
        'employeur', o.nom,
        'projet', p.nom
      )), '[]'::json)
      from public.contrats c
      left join public.organisations o on o.id = c.organisation_id
      left join public.projets p on p.id = c.projet_id
      where c.user_id = v_user
    ),
    'situation', (
      select json_build_object('droits_ouverts', s.droits_ouverts, 'date_anniversaire', s.date_anniversaire)
      from public.situation_intermittence s
      where s.user_id = v_user
    ),
    'regles', (
      select coalesce(json_agg(json_build_object('cle', r.cle, 'valeur', r.valeur, 'verifie_le', r.verifie_le)), '[]'::json)
      from public.regles_override r
      where r.user_id = v_user
    )
  );
end;
$$;

-- Appelable sans session (c'est le but) : sans la bonne clé de 256 bits, elle ne renvoie rien.
revoke all on function public.donnees_widget(text) from public, authenticated;
grant execute on function public.donnees_widget(text) to anon;
