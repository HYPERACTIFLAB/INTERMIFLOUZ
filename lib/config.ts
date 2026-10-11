/** Vrai quand les variables Supabase sont renseignées. */
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * Mode démo : uniquement en développement local, sans Supabase configuré.
 * Permet de voir l'interface sans compte. Jamais actif une fois déployé.
 */
export const demoMode = !supabaseConfigured && process.env.NODE_ENV !== "production";

/** Liste des e-mails autorisés (vide = personne, par sécurité). */
export function isEmailAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
