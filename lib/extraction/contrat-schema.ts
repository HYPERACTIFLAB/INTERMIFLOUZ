import { z } from "zod";

const confiance = z
  .enum(["haute", "moyenne", "basse"])
  .describe("haute = lu clairement ; moyenne = déduit ou partiellement lisible ; basse = deviné ou absent");

function champ<T extends z.ZodType>(valeur: T, description: string) {
  return z
    .object({
      valeur: valeur.nullable().describe("null si l'information n'est pas dans le document"),
      confiance,
      source: z
        .string()
        .nullable()
        .describe("Court extrait du document d'où vient la valeur (max 80 caractères), ou null"),
    })
    .describe(description);
}

/** Ce que Claude doit renvoyer après lecture d'un contrat ou d'une fiche de paie. */
export const ContratExtractionSchema = z.object({
  type_document: z.enum(["contrat", "fiche_paie", "aem", "autre"]),
  employeur_nom: champ(z.string(), "Raison sociale de l'employeur"),
  employeur_siret: champ(z.string(), "SIRET de l'employeur, 14 chiffres sans espaces"),
  employeur_numero_objet: champ(
    z.string(),
    "Numéro d'objet (spectacle/production) attribué par France Travail / Congés Spectacles, s'il figure",
  ),
  employeur_adresse: champ(z.string(), "Adresse postale de l'employeur"),
  projet: champ(z.string(), "Titre de la production, du film, du clip ou du projet"),
  poste: champ(z.string(), "Emploi ou fonction occupée (ex. chef opérateur, réalisateur)"),
  annexe: champ(
    z.enum(["8", "10", "regime_general"]),
    "Annexe d'assurance chômage : 8 pour les techniciens/ouvriers, 10 pour les artistes",
  ),
  date_debut: champ(z.string(), "Premier jour du contrat ou de la période de paie, format AAAA-MM-JJ"),
  date_fin: champ(z.string(), "Dernier jour du contrat ou de la période de paie, format AAAA-MM-JJ"),
  jours_travailles: champ(
    z.array(z.string()),
    "Liste des jours travaillés au format AAAA-MM-JJ, uniquement s'ils sont listés explicitement",
  ),
  heures: champ(z.number(), "Nombre total d'heures travaillées sur le contrat"),
  cachets: champ(z.number(), "Nombre de cachets (0 si le contrat est payé à l'heure)"),
  salaire_brut: champ(z.number(), "Salaire brut total en euros (ex. 1234.56)"),
  salaire_net: champ(z.number(), "Salaire net à payer avant impôt en euros (ex. 987.65)"),
  remarques: z
    .string()
    .nullable()
    .describe("Ce que l'utilisateur doit vérifier en priorité (incohérences, illisible…), en français, ou null"),
});

export type ContratExtraction = z.infer<typeof ContratExtractionSchema>;

/** Noms des champs extraits (hors type_document et remarques). */
export const CHAMPS_CONTRAT = [
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
] as const;

export type ChampContrat = (typeof CHAMPS_CONTRAT)[number];

/** Champs à vérifier : confiance moyenne/basse, ou absents alors qu'ils sont importants. */
export function champsIncertains(extraction: ContratExtraction): ChampContrat[] {
  const importants: ChampContrat[] = ["employeur_nom", "date_debut", "date_fin", "heures", "salaire_brut"];
  return CHAMPS_CONTRAT.filter((nom) => {
    const c = extraction[nom];
    if (c.confiance !== "haute") return c.valeur !== null || importants.includes(nom);
    return c.valeur === null && importants.includes(nom);
  });
}
