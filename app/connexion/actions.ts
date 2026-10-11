"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isEmailAllowed } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type CodeState = { etape: "email" | "code"; email?: string; error?: string; info?: string };

/** Étape 1 : envoie un code à 6 chiffres par e-mail (uniquement aux adresses autorisées). */
export async function envoyerCode(_: CodeState, formData: FormData): Promise<CodeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { etape: "email", error: "Adresse e-mail invalide." };

  // Même message que pour une adresse autorisée : on ne révèle pas qui a accès.
  if (!isEmailAllowed(email)) return { etape: "code", email, info: "Si cette adresse est autorisée, un code vient d'être envoyé." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    return {
      etape: "email",
      email,
      error:
        error.status === 429
          ? "Trop de demandes. Attends une minute avant de redemander un code."
          : "L'envoi du code a échoué : " + error.message,
    };
  }
  return { etape: "code", email, info: "Un code vient d'être envoyé à " + email + "." };
}

/** Étape 2 : vérifie le code et ouvre la session. */
export async function verifierCode(_: CodeState, formData: FormData): Promise<CodeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) return { etape: "code", email, error: "Le code est composé de chiffres." };
  if (!isEmailAllowed(email)) return { etape: "code", email, error: "Code incorrect ou expiré." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { etape: "code", email, error: "Code incorrect ou expiré. Redemande un code." };
  }
  redirect("/");
}

export type LoginState = { email?: string; error?: string };

/** Connexion par e-mail + mot de passe. */
export async function connexionMotDePasse(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const refus = { email, error: "E-mail ou mot de passe incorrect." };
  if (!email || !password || !isEmailAllowed(email)) return refus;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return error.status === 429 ? { email, error: "Trop de tentatives. Réessaie dans quelques minutes." } : refus;
  }
  redirect(data.user?.user_metadata?.doit_changer_mdp ? "/mot-de-passe" : "/");
}
