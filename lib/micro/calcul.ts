import { v, type Regles } from "@/lib/regles/regles";
import { ajouterMois, bornesMois, joursInclus } from "@/lib/regles/dates";

/** Ligne d'un devis ou d'une facture (prix unitaire en centimes). */
export type Ligne = { description: string; quantite: number; unite: string; prix_unitaire: number };

export const montantLigne = (l: Ligne) => Math.round(l.quantite * l.prix_unitaire);
export const totalLignes = (lignes: Ligne[]) => lignes.reduce((s, l) => s + montantLigne(l), 0);

const moisDe = (iso: string) => iso.slice(0, 7);
const finDuMois = (mois: string) => bornesMois(mois).fin;
const moisSuivant = (mois: string, n = 1) => ajouterMois(mois + "-01", n).slice(0, 7);

/**
 * Taux total prélevé par l'URSSAF sur le chiffre d'affaires d'un mois (en %) :
 * cotisations + versement libératoire + formation professionnelle,
 * + taxe chambre de métiers à partir de la 2e année civile d'activité.
 */
export function tauxPrelevement(regles: Regles, mois: string, debutActivite: string) {
  const deuxiemeAnnee = Number(mois.slice(0, 4)) > Number(debutActivite.slice(0, 4));
  return (
    v(regles, "micro_taux_cotisations") +
    v(regles, "micro_taux_vl") +
    v(regles, "micro_taux_cfp") +
    (deuxiemeAnnee ? v(regles, "micro_taux_cma") : 0)
  );
}

export type Echeance = {
  /** Mois couverts (AAAA-MM), du plus ancien au plus récent. */
  mois: string[];
  date_limite: string;
  ca: number;
  montant: number;
  taux: number;
  statut: "faite" | "a_faire" | "en_retard" | "a_venir";
};

/**
 * Déclarations mensuelles URSSAF, du début d'activité jusqu'au mois en cours.
 * La première regroupe les premiers mois : elle est due à la fin du 4e mois qui suit
 * le mois de début (ex. début en août → 31 décembre pour août à novembre).
 * Ensuite, chaque mois se déclare avant la fin du mois suivant.
 */
export function echeancesUrssaf(
  debutActivite: string,
  aujourdhui: string,
  caParMois: Map<string, number>,
  declares: Set<string>,
  regles: Regles,
): Echeance[] {
  const premierMois = moisDe(debutActivite);
  const premiereLimite = finDuMois(moisSuivant(premierMois, 4));
  const groupes = new Map<string, string[]>();
  for (let m = premierMois; m <= moisDe(aujourdhui); m = moisSuivant(m)) {
    const normale = finDuMois(moisSuivant(m));
    const limite = normale < premiereLimite ? premiereLimite : normale;
    groupes.set(limite, [...(groupes.get(limite) ?? []), m]);
  }
  return [...groupes.entries()].map(([date_limite, mois]) => {
    const ca = mois.reduce((s, m) => s + (caParMois.get(m) ?? 0), 0);
    const taux = tauxPrelevement(regles, mois[mois.length - 1], debutActivite);
    const termine = finDuMois(mois[mois.length - 1]) < aujourdhui;
    return {
      mois,
      date_limite,
      ca,
      montant: Math.round((ca * taux) / 100),
      taux,
      statut: mois.every((m) => declares.has(m))
        ? "faite"
        : !termine
          ? "a_venir"
          : date_limite < aujourdhui
            ? "en_retard"
            : "a_faire",
    };
  });
}

/** Plafond de chiffre d'affaires de l'année, proratisé l'année de création. */
export function plafondAnnee(regles: Regles, annee: number, debutActivite: string) {
  const plafond = v(regles, "micro_plafond_ca") * 100;
  if (Number(debutActivite.slice(0, 4)) !== annee) return plafond;
  const fin = `${annee}-12-31`;
  return Math.round((plafond * joursInclus(debutActivite, fin)) / joursInclus(`${annee}-01-01`, fin));
}

/** Chiffre d'affaires encaissé par mois (centimes). */
export function caParMois(paiements: { date: string; montant: number }[]) {
  const m = new Map<string, number>();
  for (const p of paiements) m.set(moisDe(p.date), (m.get(moisDe(p.date)) ?? 0) + p.montant);
  return m;
}

/** Une facture émise non payée après son échéance est en retard. */
export function enRetard(f: { statut: string; date_echeance: string | null }, aujourdhui: string) {
  return f.statut === "emise" && !!f.date_echeance && f.date_echeance < aujourdhui;
}
