import type { SupabaseClient } from "@supabase/supabase-js";
import { extraireContrat, extraireJustificatif, ExtractionError } from "./core";
import { SUPPORTED_MIME, type SupportedMime } from "./config";

/**
 * Lit un document déjà enregistré (table documents + stockage) avec Claude et
 * enregistre le résultat. Utilisé par la tâche de fond Netlify et, en local, par
 * une action serveur. Le client Supabase doit agir au nom de l'utilisateur (RLS).
 */
export async function lancerExtraction(supabase: SupabaseClient, documentId: string) {
  const { data: doc } = await supabase
    .from("documents")
    .select("id, chemin_stockage, mime, type")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return;

  const echec = (message: string) =>
    supabase.from("documents").update({ extraction_statut: "erreur", extraction_erreur: message }).eq("id", documentId);

  if (!(SUPPORTED_MIME as readonly string[]).includes(doc.mime)) return echec("Format non pris en charge.");

  await supabase.from("documents").update({ extraction_statut: "en_cours", extraction_erreur: null }).eq("id", documentId);

  const { data: fichier, error } = await supabase.storage.from("documents").download(doc.chemin_stockage);
  if (error || !fichier) return echec("Fichier introuvable.");

  try {
    const contenu = Buffer.from(await fichier.arrayBuffer());
    const result =
      doc.type === "justificatif"
        ? await extraireJustificatif(contenu, doc.mime as SupportedMime)
        : await extraireContrat(contenu, doc.mime as SupportedMime);
    await supabase
      .from("documents")
      .update({
        extraction_statut: "a_valider",
        extraction_brute: result.extraction,
        // Pour les documents de paie, Claude corrige le type (contrat, bulletin, AEM…).
        type: "type_document" in result.extraction ? result.extraction.type_document : doc.type,
      })
      .eq("id", documentId);
    await supabase.from("usages_ia").insert({
      document_id: documentId,
      modele: result.modele,
      tokens_entree: result.tokensEntree,
      tokens_sortie: result.tokensSortie,
      cout_estime_usd: result.coutUsd,
    });
  } catch (e) {
    if (!(e instanceof ExtractionError)) console.error(e);
    await echec(e instanceof ExtractionError ? e.message : "La lecture automatique a échoué.");
  }
}
