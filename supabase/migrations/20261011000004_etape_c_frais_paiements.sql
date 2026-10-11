-- Accueil + étape c : salaire perçu ou non, notes de frais.

-- Suivi du paiement des salaires
alter table public.contrats
  add column paye boolean not null default false,
  add column date_paiement date;

-- Un contrat qui a déjà son bulletin de paie est très probablement payé.
update public.contrats c set paye = true
where exists (select 1 from public.documents d where d.contrat_id = c.id and d.type = 'fiche_paie');

-- Notes de frais
create table public.notes_de_frais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  marchand text,
  description text,
  montant_ttc bigint not null check (montant_ttc >= 0),
  tva bigint check (tva >= 0),
  categorie text not null default 'autre'
    check (categorie in ('transport', 'repas', 'hebergement', 'materiel', 'location_materiel', 'logiciel', 'communication', 'autre')),
  moyen_paiement text,
  refacturable_a text not null default 'employeur' check (refacturable_a in ('employeur', 'client', 'aucun')),
  organisation_id uuid references public.organisations (id) on delete set null,
  projet_id uuid references public.projets (id) on delete set null,
  contrat_id uuid references public.contrats (id) on delete set null,
  statut text not null default 'a_rembourser' check (statut in ('a_rembourser', 'rembourse', 'non_remboursable')),
  date_remboursement date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_de_frais_user_idx on public.notes_de_frais (user_id, date desc);
create trigger notes_de_frais_updated_at before update on public.notes_de_frais
  for each row execute function public.set_updated_at();
alter table public.notes_de_frais enable row level security;
create policy "proprietaire" on public.notes_de_frais for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Justificatifs rattachés aux notes de frais
alter table public.documents
  add column note_frais_id uuid references public.notes_de_frais (id) on delete set null;
create index documents_note_frais_idx on public.documents (note_frais_id);
