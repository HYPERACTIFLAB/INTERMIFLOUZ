-- Étape d : micro-entreprise (paramètres, devis, factures, encaissements, déclarations URSSAF).

-- Infos de l'entreprise, affichées sur les devis et factures (saisies par l'utilisateur).
create table public.parametres_entreprise (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nom text,
  nom_commercial text,
  activite text,
  siret text,
  adresse text,
  email text,
  telephone text,
  iban text,
  bic text,
  date_debut_activite date,
  mention_tva text not null default 'TVA non applicable, art. 293 B du CGI',
  conditions_paiement text not null default 'Paiement à 30 jours par virement bancaire.',
  penalites_retard text not null default 'En cas de retard de paiement : pénalités au taux de 3 fois le taux d''intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce). Pas d''escompte pour paiement anticipé.',
  updated_at timestamptz not null default now()
);

-- Numéros D-2026-001 / F-2026-001 : un compteur par type et par année.
create table public.compteurs_numeros (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('devis', 'facture')),
  annee int not null,
  dernier int not null default 0,
  primary key (user_id, type, annee)
);

create table public.devis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  numero text not null,
  organisation_id uuid references public.organisations (id) on delete set null,
  projet_id uuid references public.projets (id) on delete set null,
  objet text,
  date_emission date not null default current_date,
  date_validite date,
  -- [{ description, quantite, unite, prix_unitaire (centimes) }]
  lignes jsonb not null default '[]'::jsonb check (jsonb_typeof(lignes) = 'array'),
  total integer not null default 0,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'envoye', 'accepte', 'refuse')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, numero)
);

create table public.factures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Attribué à l'émission (les brouillons n'ont pas de numéro : la suite reste sans trou).
  numero text,
  devis_id uuid references public.devis (id) on delete set null,
  organisation_id uuid references public.organisations (id) on delete set null,
  projet_id uuid references public.projets (id) on delete set null,
  objet text,
  date_emission date,
  date_echeance date,
  lignes jsonb not null default '[]'::jsonb check (jsonb_typeof(lignes) = 'array'),
  total integer not null default 0,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'emise', 'payee', 'annulee')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, numero)
);

-- Encaissements : le chiffre d'affaires micro se déclare à l'encaissement.
-- Sans facture (facture_id vide) pour une recette ponctuelle.
create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  facture_id uuid references public.factures (id) on delete cascade,
  date date not null default current_date,
  montant integer not null check (montant > 0),
  moyen text,
  libelle text,
  created_at timestamptz not null default now()
);

-- Déclarations URSSAF faites (les mois à déclarer sont calculés par l'appli).
create table public.declarations_urssaf (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mois text not null check (mois ~ '^\d{4}-\d{2}$'),
  ca_declare integer not null default 0,
  montant_paye integer,
  date_declaration date not null default current_date,
  primary key (user_id, mois)
);

create index devis_user_idx on public.devis (user_id, date_emission desc);
create index factures_user_idx on public.factures (user_id, created_at desc);
create index paiements_user_idx on public.paiements (user_id, date);
create index paiements_facture_idx on public.paiements (facture_id);
create index devis_organisation_idx on public.devis (organisation_id);
create index devis_projet_idx on public.devis (projet_id);
create index factures_organisation_idx on public.factures (organisation_id);
create index factures_projet_idx on public.factures (projet_id);
create index factures_devis_idx on public.factures (devis_id);

alter table public.parametres_entreprise enable row level security;
alter table public.compteurs_numeros enable row level security;
alter table public.devis enable row level security;
alter table public.factures enable row level security;
alter table public.paiements enable row level security;
alter table public.declarations_urssaf enable row level security;

create policy "proprietaire" on public.parametres_entreprise for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proprietaire" on public.compteurs_numeros for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proprietaire" on public.devis for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proprietaire" on public.factures for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proprietaire" on public.paiements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proprietaire" on public.declarations_urssaf for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Numéro suivant (D-2026-001, F-2026-001…), sans doublon même en cas de clics simultanés.
-- « security invoker » : les règles RLS s'appliquent, chacun n'avance que ses compteurs.
create function public.prochain_numero(p_type text, p_annee int)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.compteurs_numeros (user_id, type, annee, dernier)
  values ((select auth.uid()), p_type, p_annee, 1)
  on conflict (user_id, type, annee)
  do update set dernier = public.compteurs_numeros.dernier + 1
  returning dernier into n;
  return (case p_type when 'facture' then 'F' else 'D' end) || '-' || p_annee || '-' || lpad(n::text, 3, '0');
end;
$$;

-- Émet une facture brouillon : numéro + date + statut en une seule opération (pas de trou dans la suite).
create function public.emettre_facture(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_date date;
  v_numero text;
begin
  select coalesce(date_emission, current_date) into v_date
    from public.factures where id = p_id and statut = 'brouillon' and numero is null
    for update;
  if not found then
    raise exception 'Facture introuvable ou déjà émise';
  end if;
  v_numero := public.prochain_numero('facture', extract(year from v_date)::int);
  update public.factures
     set numero = v_numero, statut = 'emise', date_emission = v_date,
         date_echeance = coalesce(date_echeance, v_date + 30), updated_at = now()
   where id = p_id;
  return v_numero;
end;
$$;

revoke all on function public.prochain_numero(text, int) from public, anon;
revoke all on function public.emettre_facture(uuid) from public, anon;
grant execute on function public.prochain_numero(text, int) to authenticated;
grant execute on function public.emettre_facture(uuid) to authenticated;
