import "server-only";
import { demoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Accès à la base pour l'utilisateur connecté (les règles RLS s'appliquent).
 * Renvoie null en mode démo : la page affiche alors un message.
 */
export async function getDb() {
  if (demoMode) return null;
  const user = await getCurrentUser();
  const supabase = await createClient();
  return { supabase, user };
}

/** Comme getDb, mais pour les actions : refuse d'agir en mode démo. */
export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Mode démo : rien ne peut être enregistré sans Supabase.");
  return db;
}
