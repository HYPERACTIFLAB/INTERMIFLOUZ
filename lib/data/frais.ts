import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPeriode } from "@/lib/format";
import type { CategorieFrais } from "@/lib/extraction/justificatif";

export type NoteFrais = {
  id: string;
  date: string;
  marchand: string | null;
  description: string | null;
  montant_ttc: number;
  tva: number | null;
  categorie: CategorieFrais;
  moyen_paiement: string | null;
  refacturable_a: "employeur" | "client" | "aucun";
  organisation_id: string | null;
  projet_id: string | null;
  contrat_id: string | null;
  statut: "a_rembourser" | "rembourse" | "non_remboursable";
  date_remboursement: string | null;
  notes: string | null;
  organisation?: { nom: string } | null;
  projet?: { nom: string } | null;
};

export async function listNotes(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("notes_de_frais")
    .select("*, organisation:organisations(nom), projet:projets(nom)")
    .order("date", { ascending: false });
  return (data ?? []) as NoteFrais[];
}

/** Contrats proposés dans le formulaire (les plus récents d'abord). */
export async function listContratsChoix(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("contrats")
    .select("id, date_debut, date_fin, organisation_id, poste, organisation:organisations(nom)")
    .order("date_debut", { ascending: false })
    .limit(100);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    organisation_id: c.organisation_id as string | null,
    date_debut: c.date_debut as string,
    date_fin: c.date_fin as string,
    libelle: `${(c.organisation as unknown as { nom: string } | null)?.nom ?? "Sans employeur"} · ${formatPeriode(c.date_debut as string, c.date_fin as string)}`,
  }));
}
