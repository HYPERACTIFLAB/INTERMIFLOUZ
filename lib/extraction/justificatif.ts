import { z } from "zod";

export const CATEGORIES_FRAIS = [
  "transport",
  "repas",
  "hebergement",
  "materiel",
  "location_materiel",
  "logiciel",
  "communication",
  "autre",
] as const;
export type CategorieFrais = (typeof CATEGORIES_FRAIS)[number];

export const LIBELLES_CATEGORIE: Record<CategorieFrais, string> = {
  transport: "Transport",
  repas: "Repas",
  hebergement: "Hébergement",
  materiel: "Matériel",
  location_materiel: "Location de matériel",
  logiciel: "Logiciel / abonnement",
  communication: "Téléphone / internet",
  autre: "Autre",
};

const CHAMPS = ["marchand", "date", "montant_ttc", "tva", "categorie", "moyen_paiement", "description"] as const;
export type ChampJustificatif = (typeof CHAMPS)[number];

/** Format imposé à Claude pour un ticket ou une facture (plat, comme pour les contrats). */
export const ClaudeJustificatifFormat = z.object({
  marchand: z.string().describe("Nom du commerce ou du prestataire"),
  date: z.string().describe("Date de l'achat, AAAA-MM-JJ"),
  montant_ttc: z.string().describe("Total payé TTC en euros, ex. 23.50"),
  tva: z.string().describe("Montant total de TVA en euros, ou chaîne vide"),
  categorie: z.enum(CATEGORIES_FRAIS),
  moyen_paiement: z.string().describe("CB, espèces, virement… ou chaîne vide"),
  description: z.string().describe("Ce qui a été acheté, en quelques mots"),
  champs_incertains: z.array(z.enum(CHAMPS)).describe("Champs lus avec un doute"),
  remarques: z.string().describe("Points à vérifier, en français, ou chaîne vide"),
});
export type ClaudeJustificatif = z.infer<typeof ClaudeJustificatifFormat>;

/** Format interne, stocké dans documents.extraction_brute pour un justificatif. */
export const JustificatifExtractionSchema = z.object({
  genre: z.literal("justificatif"),
  marchand: z.string().nullable(),
  date: z.string().nullable(),
  montant_ttc: z.number().nullable(),
  tva: z.number().nullable(),
  categorie: z.enum(CATEGORIES_FRAIS),
  moyen_paiement: z.string().nullable(),
  description: z.string().nullable(),
  incertains: z.array(z.string()),
  remarques: z.string().nullable(),
});
export type JustificatifExtraction = z.infer<typeof JustificatifExtractionSchema>;

const nombre = (s: string) => {
  const brut = s.replace(/\s|€/g, "").replace(",", ".");
  const n = Number(brut);
  return brut !== "" && Number.isFinite(n) ? n : null;
};

export function normaliserJustificatif(r: ClaudeJustificatif): JustificatifExtraction {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date.trim()) ? r.date.trim() : null;
  const montant = nombre(r.montant_ttc);
  const incertains = new Set<string>(r.champs_incertains);
  if (!date) incertains.add("date");
  if (montant === null) incertains.add("montant_ttc");
  return {
    genre: "justificatif",
    marchand: r.marchand.trim() || null,
    date,
    montant_ttc: montant,
    tva: nombre(r.tva),
    categorie: r.categorie,
    moyen_paiement: r.moyen_paiement.trim() || null,
    description: r.description.trim() || null,
    incertains: [...incertains],
    remarques: r.remarques.trim() || null,
  };
}

export const SYSTEM_JUSTIFICATIF = `Tu lis des justificatifs de dépenses professionnelles français (tickets de caisse, factures, reçus) d'un réalisateur / photographe.
Extrais uniquement ce qui figure sur le document. N'invente rien : si une information est absente, laisse le champ vide ("").
Dates au format AAAA-MM-JJ, montants en euros avec un point décimal. Le montant est le total réellement payé (TTC).
Catégories : transport (train, taxi, carburant, péage, parking), repas, hebergement, materiel (achat), location_materiel, logiciel, communication, autre.
Liste dans champs_incertains les champs lus avec un doute.`;

export const CONSIGNE_JSON_JUSTIFICATIF = `Réponds uniquement par un objet JSON, sans texte autour, avec exactement ces clés :
marchand, date, montant_ttc, tva, categorie (${CATEGORIES_FRAIS.join(" | ")}), moyen_paiement, description (chaînes, "" si absent),
champs_incertains (tableau), remarques (chaîne).`;
