"use client";

import { createClient } from "@/lib/supabase/client";
import { extraireMaintenant } from "./actions";

/**
 * Lance la lecture par Claude en tâche de fond (Netlify) sans attendre le résultat.
 * Sans tâche de fond disponible (développement local), lit directement.
 * Renvoie true si la lecture tourne en tâche de fond.
 */
export async function lancerLecture(documentId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const reponse = token
    ? await fetch("/.netlify/functions/extraction-background", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      }).catch(() => null)
    : null;

  if (reponse?.status === 202) return true;
  await extraireMaintenant(documentId);
  return false;
}

/** Lance la lecture puis attend son résultat (3 minutes maximum). */
export async function lireDocument(documentId: string) {
  if (!(await lancerLecture(documentId))) return;
  const supabase = createClient();
  const fin = Date.now() + 180_000;
  while (Date.now() < fin) {
    await new Promise((r) => setTimeout(r, 2500));
    const { data: doc } = await supabase.from("documents").select("extraction_statut").eq("id", documentId).maybeSingle();
    if (doc && doc.extraction_statut !== "en_cours") return;
  }
}
