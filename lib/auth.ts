import "server-only";
import { redirect } from "next/navigation";
import { demoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null; name: string | null };

/**
 * Utilisateur connecté, vérifié côté serveur.
 * Redirige vers /connexion si personne n'est connecté.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  if (demoMode) return { id: "demo", email: null, name: null };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/connexion");

  const meta = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    name: (meta.full_name as string) ?? (meta.name as string) ?? null,
  };
}
