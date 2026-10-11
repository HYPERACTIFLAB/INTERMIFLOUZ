import "server-only";
import { googleIdentifiants, NOM_AGENDA, URL_AGENDA, URL_JETON, URL_REVOCATION } from "./config";

export class ErreurGoogle extends Error {
  constructor(
    message: string,
    public statut: number,
    /** Vrai si l'accès a été retiré : il faut reconnecter Google. */
    public reconnecter = false,
  ) {
    super(message);
  }
}

/** Échange un code d'autorisation contre des jetons. */
export async function echangerCode(code: string, redirectUri: string) {
  const { id, secret } = googleIdentifiants();
  const r = await fetch(URL_JETON, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErreurGoogle(`Google a refusé la connexion (${json.error ?? r.status}).`, r.status);
  return json as { access_token: string; refresh_token?: string; scope?: string };
}

/** Jeton d'accès (valable 1 h) à partir du jeton de renouvellement. */
export async function jetonAcces(refreshToken: string) {
  const { id, secret } = googleIdentifiants();
  const r = await fetch(URL_JETON, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: id, client_secret: secret, grant_type: "refresh_token" }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const retire = json.error === "invalid_grant";
    throw new ErreurGoogle(
      retire ? "L'accès à Google Agenda a expiré ou a été retiré : reconnecte Google." : `Google ne répond pas (${json.error ?? r.status}).`,
      r.status,
      retire,
    );
  }
  return json.access_token as string;
}

export async function revoquer(jeton: string) {
  await fetch(URL_REVOCATION, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: jeton }),
  }).catch(() => {});
}

/** Appels à l'API Google Agenda avec un jeton d'accès. */
export function clientAgenda(acces: string) {
  async function appel(methode: string, chemin: string, corps?: unknown) {
    const r = await fetch(URL_AGENDA + chemin, {
      method: methode,
      headers: { Authorization: `Bearer ${acces}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const json = r.status === 204 ? null : await r.json().catch(() => null);
    return { statut: r.status, ok: r.ok, json };
  }
  const echec = (quoi: string, r: { statut: number; json: unknown }) => {
    const message = (r.json as { error?: { message?: string } } | null)?.error?.message;
    return new ErreurGoogle(`${quoi} : ${message ?? "erreur " + r.statut}`, r.statut, r.statut === 401);
  };

  return {
    async creerAgenda() {
      const r = await appel("POST", "/calendars", { summary: NOM_AGENDA, timeZone: "Europe/Paris", description: "Jours de tournage, créés par Intermiflouze." });
      if (!r.ok) throw echec("Création de l'agenda impossible", r);
      return (r.json as { id: string }).id;
    },
    /** Crée ou met à jour un événement (identifiant fixé par l'appli). Renvoie false si l'agenda n'existe plus. */
    async enregistrerEvenement(agendaId: string, ev: { id: string } & Record<string, unknown>) {
      const base = `/calendars/${encodeURIComponent(agendaId)}/events`;
      const maj = await appel("PUT", `${base}/${ev.id}`, ev);
      if (maj.ok) return true;
      if (maj.statut !== 404 && maj.statut !== 410) throw echec("Mise à jour de l'événement impossible", maj);
      const ajout = await appel("POST", base, ev);
      if (ajout.ok) return true;
      if (ajout.statut === 404) return false;
      throw echec("Ajout de l'événement impossible", ajout);
    },
    async supprimerEvenement(agendaId: string, eventId: string) {
      const r = await appel("DELETE", `/calendars/${encodeURIComponent(agendaId)}/events/${eventId}`);
      // Déjà supprimé dans Google : rien à faire.
      if (!r.ok && r.statut !== 404 && r.statut !== 410) throw echec("Suppression de l'événement impossible", r);
    },
  };
}
