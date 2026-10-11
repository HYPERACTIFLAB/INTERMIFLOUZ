import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appliquerModifications } from "@/lib/regles/regles";
import type { ContratCalcul, Situation } from "@/lib/regles/intermittence";

export type SituationComplete = Situation & {
  date_ouverture: string | null;
  aj_actuelle: number | null;
  notes: string | null;
  objectif_aj: number | null;
  /** Centimes par heure. */
  objectif_taux_horaire: number | null;
  objectif_heures_jour: number | null;
};

const SITUATION_VIDE: SituationComplete = {
  droits_ouverts: false,
  date_anniversaire: null,
  date_ouverture: null,
  aj_actuelle: null,
  notes: null,
  objectif_aj: null,
  objectif_taux_horaire: null,
  objectif_heures_jour: null,
};

/** Règles de calcul : fichier config/regles.json + valeurs modifiées dans l'appli. */
export async function chargerRegles(supabase: SupabaseClient) {
  const { data } = await supabase.from("regles_override").select("cle, valeur, verifie_le");
  return appliquerModifications((data ?? []).map((r) => ({ cle: r.cle, valeur: Number(r.valeur), verifie_le: r.verifie_le })));
}

export async function chargerSituation(supabase: SupabaseClient): Promise<SituationComplete> {
  const { data } = await supabase
    .from("situation_intermittence")
    .select("droits_ouverts, date_anniversaire, date_ouverture, aj_actuelle, notes, objectif_aj, objectif_taux_horaire, objectif_heures_jour")
    .maybeSingle();
  const nombre = (x: unknown) => (x === null || x === undefined ? null : Number(x));
  return data
    ? {
        ...data,
        aj_actuelle: nombre(data.aj_actuelle),
        objectif_aj: nombre(data.objectif_aj),
        objectif_heures_jour: nombre(data.objectif_heures_jour),
      }
    : SITUATION_VIDE;
}

/** Tous les contrats, au format du moteur de calcul. */
export type ContratTableau = ContratCalcul & {
  salaire_net: number | null;
  paye: boolean;
  statut_aem: "a_recevoir" | "recue" | "transmise";
};

export async function chargerContratsCalcul(supabase: SupabaseClient): Promise<ContratTableau[]> {
  const { data } = await supabase
    .from("contrats")
    .select(
      "id, date_debut, date_fin, heures, cachets, salaire_brut, salaire_net, paye, statut_aem, jours_travailles, poste, annexe, organisation:organisations(nom), projet:projets(nom)",
    )
    .order("date_debut");
  return (data ?? []).map((c) => ({
    id: c.id as string,
    date_debut: c.date_debut as string,
    date_fin: c.date_fin as string,
    heures: Number(c.heures),
    cachets: c.cachets as number,
    salaire_brut: c.salaire_brut as number | null,
    salaire_net: c.salaire_net as number | null,
    paye: c.paye as boolean,
    statut_aem: c.statut_aem as ContratTableau["statut_aem"],
    jours_travailles: (c.jours_travailles as string[]) ?? [],
    poste: c.poste as string | null,
    annexe: c.annexe as string,
    employeur: (c.organisation as unknown as { nom: string } | null)?.nom ?? null,
    projet: (c.projet as unknown as { nom: string } | null)?.nom ?? null,
  }));
}
