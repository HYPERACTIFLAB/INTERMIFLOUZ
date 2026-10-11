-- Étape f : Google Agenda.

-- Connexion à Google : jeton de renouvellement chiffré (AES-GCM) et agenda « Intermiflouze » créé par l'appli.
create table public.connexions_google (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  refresh_token_chiffre text not null,
  agenda_id text,
  app_url text,
  derniere_synchro timestamptz,
  derniere_erreur text,
  connecte_le timestamptz not null default now()
);

-- Événements créés dans Google pour chaque contrat (un par bloc de jours consécutifs).
create table public.evenements_agenda (
  contrat_id uuid primary key references public.contrats (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  google_event_ids text[] not null default '{}',
  derniere_synchro timestamptz not null default now()
);

alter table public.connexions_google enable row level security;
alter table public.evenements_agenda enable row level security;

create policy "proprietaire" on public.connexions_google for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proprietaire" on public.evenements_agenda for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index evenements_agenda_user_id_idx on public.evenements_agenda (user_id);
