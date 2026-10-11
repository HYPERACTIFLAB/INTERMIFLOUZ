import { z } from "zod";
import type { ContratExtraction } from "./contrat-schema";

/**
 * Format imposé à Claude. Volontairement sans valeurs « null » (unions), qui
 * alourdissent le schéma : chaque champ dit s'il a été trouvé, et les valeurs
 * sont des textes, convertis ensuite par `normaliser`.
 */
const confiance = z
  .enum(["haute", "moyenne", "basse"])
  .describe("haute = lu clairement ; moyenne = déduit ou partiellement lisible ; basse = deviné");

function champ(description: string) {
  return z
    .object({
      trouve: z.boolean().describe("false si l'information n'est pas dans le document"),
      valeur: z.string().describe("La valeur, ou chaîne vide si non trouvée"),
      confiance,
      source: z.string().describe("Court extrait du document d'où vient la valeur (80 caractères max), ou chaîne vide"),
    })
    .describe(description);
}

export const ClaudeContratFormat = z.object({
  type_document: z.enum(["contrat", "fiche_paie", "aem", "autre"]),
  employeur_nom: champ("Raison sociale de l'employeur"),
  employeur_siret: champ("SIRET de l'employeur, 14 chiffres sans espaces"),
  employeur_numero_objet: champ("Numéro d'objet (production) Congés Spectacles / France Travail, s'il figure"),
  employeur_adresse: champ("Adresse postale de l'employeur"),
  projet: champ("Titre de la production, du film, du clip ou du projet"),
  poste: champ("Emploi ou fonction occupée (ex. chef opérateur, réalisateur)"),
  annexe: champ("Annexe d'assurance chômage : « 8 » (techniciens), « 10 » (artistes) ou « regime_general »"),
  date_debut: champ("Premier jour du contrat ou de la période de paie, format AAAA-MM-JJ"),
  date_fin: champ("Dernier jour du contrat ou de la période de paie, format AAAA-MM-JJ"),
  jours_travailles: champ("Jours travaillés au format AAAA-MM-JJ séparés par des virgules, s'ils sont listés"),
  heures: champ("Nombre total d'heures travaillées, nombre avec un point décimal (ex. 14.5)"),
  cachets: champ("Nombre de cachets (0 si payé à l'heure)"),
  salaire_brut: champ("Salaire brut total en euros, nombre avec un point décimal (ex. 1234.56)"),
  salaire_net: champ("Net à payer avant impôt sur le revenu, en euros, nombre avec un point décimal"),
  remarques: z.string().describe("Ce que l'utilisateur doit vérifier en priorité, en français, ou chaîne vide"),
});

export type ClaudeContrat = z.infer<typeof ClaudeContratFormat>;

type ChampBrut = ClaudeContrat["employeur_nom"];

function texte(c: ChampBrut) {
  const v = c.valeur.trim();
  return { valeur: c.trouve && v ? v : null, confiance: c.confiance, source: c.source.trim() || null };
}

function nombre(c: ChampBrut) {
  const brut = c.valeur.replace(/\s|€/g, "").replace(",", ".");
  const n = Number(brut);
  return {
    valeur: c.trouve && brut !== "" && Number.isFinite(n) ? n : null,
    confiance: c.confiance,
    source: c.source.trim() || null,
  };
}

/** Convertit la réponse de Claude dans le format interne de l'appli. */
export function normaliser(r: ClaudeContrat): ContratExtraction {
  const annexe = texte(r.annexe);
  const jours = texte(r.jours_travailles);
  return {
    type_document: r.type_document,
    employeur_nom: texte(r.employeur_nom),
    employeur_siret: texte(r.employeur_siret),
    employeur_numero_objet: texte(r.employeur_numero_objet),
    employeur_adresse: texte(r.employeur_adresse),
    projet: texte(r.projet),
    poste: texte(r.poste),
    annexe: {
      ...annexe,
      valeur: annexe.valeur === "8" || annexe.valeur === "10" || annexe.valeur === "regime_general" ? annexe.valeur : null,
    },
    date_debut: texte(r.date_debut),
    date_fin: texte(r.date_fin),
    jours_travailles: {
      ...jours,
      valeur: jours.valeur ? jours.valeur.split(/[,;\s]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : null,
    },
    heures: nombre(r.heures),
    cachets: nombre(r.cachets),
    salaire_brut: nombre(r.salaire_brut),
    salaire_net: nombre(r.salaire_net),
    remarques: r.remarques.trim() || null,
  };
}
