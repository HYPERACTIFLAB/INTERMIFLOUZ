/** Google Agenda : identifiants OAuth (variables d'environnement côté serveur uniquement). */

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const NOM_AGENDA = "Tournage";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleIdentifiants() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new Error("Google Agenda n'est pas configuré (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  return { id, secret };
}

// Adresses de Google. En développement, elles peuvent pointer vers un faux serveur pour les tests.
const local = process.env.NODE_ENV !== "production" ? process.env.GOOGLE_FAUX_SERVEUR : undefined;
export const URL_AUTORISATION = local ? `${local}/o/oauth2/v2/auth` : "https://accounts.google.com/o/oauth2/v2/auth";
export const URL_JETON = local ? `${local}/token` : "https://oauth2.googleapis.com/token";
export const URL_REVOCATION = local ? `${local}/revoke` : "https://oauth2.googleapis.com/revoke";
export const URL_AGENDA = local ? `${local}/calendar/v3` : "https://www.googleapis.com/calendar/v3";

/**
 * Appli Google en mode « Test » : Google coupe l'accès 7 jours après chaque connexion.
 * On prévient un jour avant. Renvoie l'échéance, et si elle est proche ou dépassée.
 */
export function echeanceAcces(connecteLe: string, maintenant = new Date()) {
  const fin = new Date(new Date(connecteLe).getTime() + 7 * 24 * 3600 * 1000);
  const restant = fin.getTime() - maintenant.getTime();
  return { fin, bientot: restant < 24 * 3600 * 1000, expire: restant <= 0 };
}
