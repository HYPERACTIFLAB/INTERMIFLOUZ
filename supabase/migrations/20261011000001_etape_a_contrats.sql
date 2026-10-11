-- Étape a : contacts, projets, contrats, documents, suivi du coût de l'IA.
-- Chaque table appartient à un utilisateur (user_id) et est protégée par RLS :
-- personne ne peut lire ou modifier les lignes d'un autre compte.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisations (sociétés de production, clients)
-- ---------------------------------------------------------------------------
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  type text not null default 'employeur' check (type in ('employeur', 'client', 'les_deux')),
  siret text,
  numero_objet text,
  adresse text,
  email text,
  telephone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organisations_user_idx on public.organisations (user_id, nom);

-- ---------------------------------------------------------------------------
-- Contacts (interlocuteurs)
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organisation_id uuid references public.organisations (id) on delete cascade,
  prenom text,
  nom text,
  fonction text,
  email text,
  telephone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(trim(prenom), '') <> '' or coalesce(trim(nom), '') <> '')
);
create index contacts_user_idx on public.contacts (user_id);
create index contacts_organisation_idx on public.contacts (organisation_id);

-- ---------------------------------------------------------------------------
-- Projets
-- ---------------------------------------------------------------------------
create table public.projets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  organisation_id uuid references public.organisations (id) on delete set null,
  date_debut date,
  date_fin date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projets_user_idx on public.projets (user_id, nom);

-- ---------------------------------------------------------------------------
-- Contrats d'intermittence
-- Montants en centimes. Les heures « retenues » (heures + cachets convertis)
-- sont calculées par l'appli à partir des règles modifiables, pas stockées.
-- ---------------------------------------------------------------------------
create table public.contrats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organisation_id uuid references public.organisations (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  projet_id uuid references public.projets (id) on delete set null,
  poste text,
  type_contrat text not null default 'cddu' check (type_contrat in ('cddu', 'autre')),
  annexe text not null default '8' check (annexe in ('8', '10', 'regime_general')),
  date_debut date not null,
  date_fin date not null,
  jours_travailles date[] not null default '{}',
  heures numeric(7, 2) not null default 0 check (heures >= 0),
  cachets integer not null default 0 check (cachets >= 0),
  salaire_brut bigint check (salaire_brut >= 0),
  salaire_net bigint check (salaire_net >= 0),
  statut_aem text not null default 'a_recevoir' check (statut_aem in ('a_recevoir', 'recue', 'transmise')),
  date_reception_aem date,
  source text not null default 'manuel' check (source in ('manuel', 'import_ia')),
  champs_incertains text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_fin >= date_debut)
);
create index contrats_user_dates_idx on public.contrats (user_id, date_debut desc);
create index contrats_organisation_idx on public.contrats (organisation_id);

-- ---------------------------------------------------------------------------
-- Documents (PDF de contrats, fiches de paie, AEM, justificatifs…)
-- Le fichier lui-même est dans le stockage privé « documents ».
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null default 'autre'
    check (type in ('contrat', 'fiche_paie', 'aem', 'justificatif', 'devis_pdf', 'facture_pdf', 'autre')),
  chemin_stockage text not null unique,
  nom_fichier text not null,
  mime text not null,
  taille bigint not null default 0,
  contrat_id uuid references public.contrats (id) on delete set null,
  extraction_brute jsonb,
  extraction_statut text not null default 'aucune'
    check (extraction_statut in ('aucune', 'en_cours', 'a_valider', 'validee', 'erreur')),
  extraction_erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_idx on public.documents (user_id, created_at desc);
create index documents_contrat_idx on public.documents (contrat_id);

-- ---------------------------------------------------------------------------
-- Suivi du coût des lectures par Claude
-- ---------------------------------------------------------------------------
create table public.usages_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  modele text not null,
  tokens_entree integer not null default 0,
  tokens_sortie integer not null default 0,
  cout_estime_usd numeric(10, 5) not null default 0,
  created_at timestamptz not null default now()
);
create index usages_ia_user_idx on public.usages_ia (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------
create trigger organisations_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger projets_updated_at before update on public.projets
  for each row execute function public.set_updated_at();
create trigger contrats_updated_at before update on public.contrats
  for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sécurité : RLS « je ne vois que mes lignes »
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['organisations', 'contacts', 'projets', 'contrats', 'documents', 'usages_ia']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "proprietaire" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stockage privé des fichiers : documents/<user_id>/<fichier>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 Mo
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "documents : lecture de mes fichiers" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents : ajout dans mon dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents : modification de mes fichiers" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents : suppression de mes fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
