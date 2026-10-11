"use server";

import { revalidatePath } from "next/cache";
import { requireDb } from "@/lib/data/db";
import { parseNombre } from "@/lib/format";

export type ObjectifState = { error?: string; ok?: boolean };

export async function saveObjectif(_: ObjectifState, formData: FormData): Promise<ObjectifState> {
  const lire = (nom: string) => parseNombre(String(formData.get(nom) ?? ""));
  const cible = lire("objectif_aj");
  const taux = lire("objectif_taux_horaire");
  const heuresJour = lire("objectif_heures_jour");

  if (cible === null || cible <= 0) return { error: "Indique l'allocation journalière que tu vises, en euros (par exemple 90)." };
  if (cible > 1000) return { error: "C'est un montant par jour : par exemple 90 €." };
  if (taux !== null && (taux < 0 || taux > 1000)) return { error: "Salaire horaire invalide." };
  if (heuresJour !== null && (heuresJour <= 0 || heuresJour > 24)) return { error: "Heures par jour invalides (entre 1 et 24)." };

  const { supabase, user } = await requireDb();
  const { error } = await supabase.from("situation_intermittence").upsert({
    user_id: user.id,
    objectif_aj: cible,
    objectif_taux_horaire: taux === null ? null : Math.round(taux * 100),
    objectif_heures_jour: heuresJour,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Impossible d'enregistrer : " + error.message };
  revalidatePath("/objectif");
  return { ok: true };
}
