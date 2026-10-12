"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireDb } from "@/lib/data/db";
import { scriptWidget } from "@/lib/widget/script";

export type EtatWidget = { script?: string; error?: string };

/** Crée (ou remplace) la clé du widget et renvoie le script à coller dans Scriptable. */
export async function creerScriptWidget(): Promise<EtatWidget> {
  const { supabase, user } = await requireDb();
  const cle = "ifw_" + randomBytes(32).toString("base64url");
  const { error } = await supabase.from("cles_widget").upsert({
    user_id: user.id,
    cle_hash: createHash("sha256").update(cle).digest("hex"),
    cree_le: new Date().toISOString(),
    utilise_le: null,
  });
  if (error) return { error: "Impossible de créer la clé : " + error.message };

  const h = await headers();
  const hote = h.get("x-forwarded-host") ?? h.get("host");
  const protocole = h.get("x-forwarded-proto") ?? (hote?.startsWith("localhost") ? "http" : "https");
  revalidatePath("/widget");
  return { script: scriptWidget(`${protocole}://${hote}`, cle) };
}

export async function supprimerCleWidget() {
  const { supabase, user } = await requireDb();
  await supabase.from("cles_widget").delete().eq("user_id", user.id);
  revalidatePath("/widget");
}
