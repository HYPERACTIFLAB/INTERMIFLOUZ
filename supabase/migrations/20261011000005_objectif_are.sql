-- Objectif d'allocation journalière (ARE) et hypothèses des prochains contrats.

alter table public.situation_intermittence
  add column objectif_aj numeric(8, 2),
  add column objectif_taux_horaire integer, -- centimes par heure
  add column objectif_heures_jour numeric(4, 1);
