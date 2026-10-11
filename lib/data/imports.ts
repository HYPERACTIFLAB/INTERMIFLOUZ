import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContratExtraction } from "@/lib/extraction/contrat-schema";
import { chevauchement, fusionner, grouper, lireExtraction, memeEmployeur, type DocLu } from "@/lib/extraction/regroupement";

export type DocImport = {
  id: string;
  type: string;
  nom_fichier: string;
  mime: string;
  chemin_stockage: string;
  extraction_statut: "aucune" | "en_cours" | "a_valider" | "erreur" | "validee";
  extraction_erreur: string | null;
  extraction_brute: unknown;
  created_at: string;
};

/** Un « lot » = les documents d'un même tournage, à vérifier ensemble. */
export type Lot = {
  docs: DocImport[];
  /** Fiche fusionnée (null si aucun document du lot n'a été lu). */
  extraction: ContratExtraction | null;
  statut: DocImport["extraction_statut"];
};

/** Documents importés pas encore rattachés à un contrat, regroupés par tournage (plus anciens d'abord). */
export async function chargerLots(supabase: SupabaseClient): Promise<Lot[]> {
  const { data } = await supabase
    .from("documents")
    .select("id, type, nom_fichier, mime, chemin_stockage, extraction_statut, extraction_erreur, extraction_brute, created_at")
    .is("contrat_id", null)
    .in("type", ["contrat", "fiche_paie", "aem", "autre"])
    .neq("extraction_statut", "validee")
    .order("created_at");
  const docs = (data ?? []) as DocImport[];

  const lus: (DocLu & { doc: DocImport })[] = [];
  const lots: Lot[] = [];
  for (const doc of docs) {
    const extraction = doc.extraction_statut === "a_valider" ? lireExtraction(doc.extraction_brute) : null;
    if (extraction) lus.push({ id: doc.id, type: doc.type, nom_fichier: doc.nom_fichier, extraction, doc });
    else lots.push({ docs: [doc], extraction: null, statut: doc.extraction_statut });
  }
  for (const groupe of grouper(lus)) {
    lots.push({
      docs: groupe.map((g) => (g as (typeof lus)[number]).doc),
      extraction: fusionner(groupe),
      statut: "a_valider",
    });
  }
  return lots.sort((a, b) => a.docs[0].created_at.localeCompare(b.docs[0].created_at));
}

/** Contrat déjà enregistré qui correspond (même employeur, périodes qui se chevauchent). */
export async function contratCorrespondant(supabase: SupabaseClient, e: ContratExtraction) {
  if (!e.date_debut.valeur) return null;
  const { data } = await supabase
    .from("contrats")
    .select("id, poste, date_debut, date_fin, organisation:organisations(nom, siret)")
    .lte("date_debut", e.date_fin.valeur ?? e.date_debut.valeur)
    .gte("date_fin", e.date_debut.valeur);
  const contrats = (data ?? []) as unknown as {
    id: string;
    poste: string | null;
    date_debut: string;
    date_fin: string;
    organisation: { nom: string; siret: string | null } | null;
  }[];
  return (
    contrats.find(
      (c) =>
        c.organisation &&
        memeEmployeur({ siret: c.organisation.siret, nom: c.organisation.nom }, { siret: e.employeur_siret.valeur, nom: e.employeur_nom.valeur }) &&
        chevauchement(c.date_debut, c.date_fin, e.date_debut.valeur, e.date_fin.valeur),
    ) ?? null
  );
}
