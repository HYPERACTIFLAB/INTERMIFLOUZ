import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { googleConfigured } from "./config";
import { dechiffrer } from "./chiffrement";
import { clientAgenda, ErreurGoogle, jetonAcces } from "./api";
import { evenementsContrat, idEvenement, type ContratAgenda } from "./evenements";

type Connexion = { user_id: string; refresh_token_chiffre: string; agenda_id: string | null; app_url: string | null };

async function chargerConnexion(supabase: SupabaseClient) {
  if (!googleConfigured()) return null;
  const { data } = await supabase
    .from("connexions_google")
    .select("user_id, refresh_token_chiffre, agenda_id, app_url")
    .maybeSingle<Connexion>();
  return data;
}

async function ouvrir(supabase: SupabaseClient, connexion: Connexion) {
  const agenda = clientAgenda(await jetonAcces(dechiffrer(connexion.refresh_token_chiffre)));
  let agendaId = connexion.agenda_id;
  // Une seule création d'agenda par synchro, même si plusieurs envois la demandent en même temps.
  let creation: Promise<string> | null = null;
  const nouvelAgenda = () =>
    (creation ??= agenda.creerAgenda().then(async (id) => {
      agendaId = id;
      await supabase.from("connexions_google").update({ agenda_id: id }).eq("user_id", connexion.user_id);
      return id;
    }));
  return {
    agenda,
    agendaId: async () => agendaId ?? nouvelAgenda(),
    /** L'agenda a été supprimé dans Google : on en recrée un. */
    nouvelAgenda,
  };
}

async function chargerContrats(supabase: SupabaseClient, ids?: string[]) {
  let q = supabase
    .from("contrats")
    .select("id, date_debut, date_fin, jours_travailles, heures, cachets, salaire_brut, poste, organisation:organisations(nom), projet:projets(nom)");
  if (ids) q = q.in("id", ids);
  const { data } = await q;
  return (data ?? []).map(
    (c): ContratAgenda => ({
      id: c.id as string,
      date_debut: c.date_debut as string,
      date_fin: c.date_fin as string,
      jours_travailles: (c.jours_travailles as string[]) ?? [],
      heures: Number(c.heures),
      cachets: c.cachets as number,
      salaire_brut: c.salaire_brut as number | null,
      poste: c.poste as string | null,
      employeur: (c.organisation as unknown as { nom: string } | null)?.nom ?? null,
      projet: (c.projet as unknown as { nom: string } | null)?.nom ?? null,
    }),
  );
}

async function noterResultat(supabase: SupabaseClient, userId: string, erreur: string | null) {
  await supabase
    .from("connexions_google")
    .update({ derniere_erreur: erreur, ...(erreur ? {} : { derniere_synchro: new Date().toISOString() }) })
    .eq("user_id", userId);
}

/** Envoie les contrats donnés (ou tous) dans Google Agenda. */
async function envoyer(supabase: SupabaseClient, connexion: Connexion, ids?: string[]) {
  const session = await ouvrir(supabase, connexion);
  const contrats = await chargerContrats(supabase, ids);
  const { data: existants } = await supabase
    .from("evenements_agenda")
    .select("contrat_id, google_event_ids")
    .in("contrat_id", contrats.map((c) => c.id));
  const anciens = new Map((existants ?? []).map((e) => [e.contrat_id as string, e.google_event_ids as string[]]));

  const traiter = async (c: ContratAgenda) => {
    const evenements = evenementsContrat(c, connexion.app_url);
    for (const ev of evenements) {
      if (!(await session.agenda.enregistrerEvenement(await session.agendaId(), ev))) {
        await session.agenda.enregistrerEvenement(await session.nouvelAgenda(), ev);
      }
    }
    // Jours retirés du contrat : on supprime les événements en trop.
    const ids = evenements.map((e) => e.id);
    for (const ancien of anciens.get(c.id) ?? []) {
      if (!ids.includes(ancien)) await session.agenda.supprimerEvenement(await session.agendaId(), ancien);
    }
    await supabase
      .from("evenements_agenda")
      .upsert({ contrat_id: c.id, user_id: connexion.user_id, google_event_ids: ids, derniere_synchro: new Date().toISOString() });
  };

  // L'agenda est créé une seule fois avant d'envoyer en parallèle (par paquets de 4).
  await session.agendaId();
  for (let i = 0; i < contrats.length; i += 4) await Promise.all(contrats.slice(i, i + 4).map(traiter));
  return contrats.length;
}

function message(e: unknown) {
  return e instanceof ErreurGoogle ? e.message : "Erreur inattendue avec Google Agenda.";
}

/**
 * Met à jour un contrat dans Google Agenda, si Google est connecté.
 * Ne bloque jamais l'enregistrement du contrat : une erreur est seulement notée.
 */
export async function synchroniserContrat(supabase: SupabaseClient, contratId: string) {
  try {
    const connexion = await chargerConnexion(supabase);
    if (!connexion) return;
    await envoyer(supabase, connexion, [contratId]);
    await noterResultat(supabase, connexion.user_id, null);
  } catch (e) {
    console.error("Synchro Google", e);
    const { data } = await supabase.from("connexions_google").select("user_id").maybeSingle();
    if (data) await noterResultat(supabase, data.user_id as string, message(e));
  }
}

/** Tous les contrats. Renvoie le nombre de contrats envoyés, ou une erreur. */
export async function synchroniserTout(supabase: SupabaseClient): Promise<{ nombre?: number; error?: string }> {
  const connexion = await chargerConnexion(supabase);
  if (!connexion) return { error: "Google Agenda n'est pas connecté." };
  try {
    const nombre = await envoyer(supabase, connexion);
    await noterResultat(supabase, connexion.user_id, null);
    return { nombre };
  } catch (e) {
    console.error("Synchro Google", e);
    await noterResultat(supabase, connexion.user_id, message(e));
    return { error: message(e) };
  }
}

/** À appeler avant de supprimer un contrat : retire ses événements de Google Agenda. */
export async function retirerContrat(supabase: SupabaseClient, contratId: string) {
  try {
    const connexion = await chargerConnexion(supabase);
    if (!connexion?.agenda_id) return;
    const { data } = await supabase.from("evenements_agenda").select("google_event_ids").eq("contrat_id", contratId).maybeSingle();
    const ids = (data?.google_event_ids as string[] | undefined) ?? [idEvenement(contratId, 0)];
    const session = await ouvrir(supabase, connexion);
    for (const id of ids) await session.agenda.supprimerEvenement(connexion.agenda_id, id);
  } catch (e) {
    console.error("Synchro Google (suppression)", e);
  }
}
