"use server";

import { redirect } from "next/navigation";
import { demoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type MotDePasseState = { error?: string };

export async function changerMotDePasse(_: MotDePasseState, formData: FormData): Promise<MotDePasseState> {
  if (demoMode) return { error: "Indisponible en mode démo." };
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 10) return { error: "Choisis au moins 10 caractères." };
  if (password !== confirmation) return { error: "Les deux mots de passe ne sont pas identiques." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password, data: { doit_changer_mdp: false } });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Choisis un mot de passe différent de celui que tu viens d'utiliser."
          : error.code === "weak_password"
            ? "Mot de passe trop faible, choisis-en un plus long."
            : "Impossible de changer le mot de passe : " + error.message,
    };
  }
  // Nouveau jeton de session, sans l'obligation de changer le mot de passe.
  await supabase.auth.refreshSession();
  redirect("/");
}
