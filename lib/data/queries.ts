import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function listOrganisations(supabase: SupabaseClient) {
  const { data } = await supabase.from("organisations").select("id, nom, siret").order("nom");
  return (data ?? []) as { id: string; nom: string; siret: string | null }[];
}

export async function listNomsProjets(supabase: SupabaseClient) {
  const { data } = await supabase.from("projets").select("nom").order("nom");
  return (data ?? []).map((p) => p.nom as string);
}

/** Lien temporaire (10 min) pour afficher un fichier privé. */
export async function lienTemporaire(supabase: SupabaseClient, chemin: string) {
  const { data } = await supabase.storage.from("documents").createSignedUrl(chemin, 600);
  return data?.signedUrl ?? null;
}

/** Dépenses Claude du mois en cours. */
export async function usageIaDuMois(supabase: SupabaseClient) {
  const debut = new Date();
  debut.setUTCDate(1);
  debut.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase.from("usages_ia").select("cout_estime_usd").gte("created_at", debut.toISOString());
  const lignes = data ?? [];
  return {
    lectures: lignes.length,
    coutUsd: lignes.reduce((s, l) => s + Number(l.cout_estime_usd), 0),
  };
}
