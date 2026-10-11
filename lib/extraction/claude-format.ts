import { z } from "zod";
import type { ChampContrat, ContratExtraction } from "./contrat-schema";

/**
 * Format imposé à Claude : volontairement plat et minimal (des textes), car un
 * schéma trop riche est refusé (« compiled grammar is too large »).
 * Chaîne vide = information absente. Les champs incertains sont listés à part.
 */
const NOMS_CHAMPS = [
  "employeur_nom",
  "employeur_siret",
  "employeur_numero_objet",
  "employeur_adresse",
  "projet",
  "poste",
  "annexe",
  "date_debut",
  "date_fin",
  "jours_travailles",
  "heures",
  "cachets",
  "salaire_brut",
  "salaire_net",
] as const satisfies readonly ChampContrat[];

export const ClaudeContratFormat = z.object({
  type_document: z.enum(["contrat", "fiche_paie", "aem", "autre"]),
  employeur_nom: z.string().describe("Raison sociale de l'employeur"),
  employeur_siret: z.string().describe("SIRET, 14 chiffres sans espaces"),
  employeur_numero_objet: z.string().describe("Numéro d'objet de la production, s'il figure"),
  employeur_adresse: z.string().describe("Adresse de l'employeur"),
  projet: z.string().describe("Titre de la production ou du projet"),
  poste: z.string().describe("Emploi occupé"),
  annexe: z.enum(["8", "10", "regime_general", "inconnue"]).describe("8 = techniciens, 10 = artistes"),
  date_debut: z.string().describe("AAAA-MM-JJ"),
  date_fin: z.string().describe("AAAA-MM-JJ"),
  jours_travailles: z.string().describe("Jours travaillés AAAA-MM-JJ séparés par des virgules, s'ils sont listés"),
  heures: z.string().describe("Total des heures, ex. 14.5"),
  cachets: z.string().describe("Nombre de cachets"),
  salaire_brut: z.string().describe("Brut total en euros, ex. 1234.56"),
  salaire_net: z.string().describe("Net à payer avant impôt en euros, ex. 987.65"),
  champs_incertains: z.array(z.enum(NOMS_CHAMPS)).describe("Champs lus avec un doute ou déduits"),
  remarques: z.string().describe("Points à vérifier en priorité, en français, ou chaîne vide"),
});

export type ClaudeContrat = z.infer<typeof ClaudeContratFormat>;

/** Convertit la réponse de Claude dans le format interne de l'appli. */
export function normaliser(r: ClaudeContrat): ContratExtraction {
  const doute = (nom: ChampContrat) => (r.champs_incertains.includes(nom) ? "basse" : "haute") as "basse" | "haute";
  const texte = (nom: ChampContrat, v: string) => {
    const t = v.trim();
    return { valeur: t || null, confiance: t ? doute(nom) : ("basse" as const), source: null };
  };
  const nombre = (nom: ChampContrat, v: string) => {
    const brut = v.replace(/\s|€/g, "").replace(",", ".");
    const n = Number(brut);
    const ok = brut !== "" && Number.isFinite(n);
    return { valeur: ok ? n : null, confiance: ok ? doute(nom) : ("basse" as const), source: null };
  };
  const jours = r.jours_travailles.split(/[,;\s]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  return {
    type_document: r.type_document,
    employeur_nom: texte("employeur_nom", r.employeur_nom),
    employeur_siret: texte("employeur_siret", r.employeur_siret.replace(/\s/g, "")),
    employeur_numero_objet: texte("employeur_numero_objet", r.employeur_numero_objet),
    employeur_adresse: texte("employeur_adresse", r.employeur_adresse),
    projet: texte("projet", r.projet),
    poste: texte("poste", r.poste),
    annexe: {
      valeur: r.annexe === "inconnue" ? null : r.annexe,
      confiance: r.annexe === "inconnue" ? "basse" : doute("annexe"),
      source: null,
    },
    date_debut: texte("date_debut", r.date_debut),
    date_fin: texte("date_fin", r.date_fin),
    jours_travailles: { valeur: jours.length ? jours : null, confiance: jours.length ? doute("jours_travailles") : "basse", source: null },
    heures: nombre("heures", r.heures),
    cachets: nombre("cachets", r.cachets),
    salaire_brut: nombre("salaire_brut", r.salaire_brut),
    salaire_net: nombre("salaire_net", r.salaire_net),
    remarques: r.remarques.trim() || null,
  };
}
