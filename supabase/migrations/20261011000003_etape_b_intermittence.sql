-- Étape b : situation d'intermittence et règles de calcul modifiées par l'utilisateur.

create table public.situation_intermittence (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  droits_ouverts boolean not null default false,
  date_ouverture date,
  date_anniversaire date,
  aj_actuelle numeric(8, 2),
  notes text,
  updated_at timestamptz not null default now()
);

create table public.regles_override (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cle text not null,
  valeur numeric not null,
  verifie_le date,
  updated_at timestamptz not null default now(),
  primary key (user_id, cle)
);

alter table public.situation_intermittence enable row level security;
alter table public.regles_override enable row level security;

create policy "proprietaire" on public.situation_intermittence for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proprietaire" on public.regles_override for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
