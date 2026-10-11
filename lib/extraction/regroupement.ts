import { CHAMPS_CONTRAT, ContratExtractionSchema, type ChampContrat, type ContratExtraction } from "./contrat-schema";

/**
 * Regroupement des documents d'un même tournage (contrat + bulletin + AEM…)
 * pour n'avoir qu'une seule fiche à vérifier.
 * Deux documents vont ensemble s'ils ont le même employeur et des périodes qui se chevauchent.
 */

export type DocLu = {
  id: string;
  type: string;
  nom_fichier: string;
  extraction: ContratExtraction;
};

/** Lit l'extraction stockée en base ; null si absente ou illisible. */
export function lireExtraction(brut: unknown): ContratExtraction | null {
  const r = ContratExtractionSchema.safeParse(brut);
  return r.success ? r.data : null;
}

const FORMES_JURIDIQUES = /\b(sas|sasu|sarl|eurl|sa|sci|scop|association|ste|societe)\b/g;

export function normaliserNom(nom: string | null | undefined) {
  return (nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(FORMES_JURIDIQUES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Même employeur : même SIRET, ou noms identiques / l'un contenu dans l'autre. */
export function memeEmployeur(
  a: { siret?: string | null; nom?: string | null },
  b: { siret?: string | null; nom?: string | null },
) {
  const sa = a.siret?.replace(/\D/g, "");
  const sb = b.siret?.replace(/\D/g, "");
  if (sa && sb && sa.length === 14 && sb.length === 14) return sa === sb;
  const na = normaliserNom(a.nom);
  const nb = normaliserNom(b.nom);
  if (!na || !nb) return false;
  return na === nb || (na.length >= 4 && nb.includes(na)) || (nb.length >= 4 && na.includes(nb));
}

/** Les périodes [début, fin] se chevauchent (dates AAAA-MM-JJ). */
export function chevauchement(d1: string | null, f1: string | null, d2: string | null, f2: string | null) {
  if (!d1 || !d2) return false;
  const fin1 = f1 ?? d1;
  const fin2 = f2 ?? d2;
  return d1 <= fin2 && d2 <= fin1;
}

function employeur(e: ContratExtraction) {
  return { siret: e.employeur_siret.valeur, nom: e.employeur_nom.valeur };
}

function vontEnsemble(a: ContratExtraction, b: ContratExtraction) {
  return (
    memeEmployeur(employeur(a), employeur(b)) &&
    chevauchement(a.date_debut.valeur, a.date_fin.valeur, b.date_debut.valeur, b.date_fin.valeur)
  );
}

/** Regroupe les documents lus (union des paires compatibles). Ordre d'entrée conservé. */
export function grouper(docs: DocLu[]): DocLu[][] {
  const parent = docs.map((_, i) => i);
  const racine = (i: number): number => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      if (vontEnsemble(docs[i].extraction, docs[j].extraction)) parent[racine(j)] = racine(i);
    }
  }
  const groupes = new Map<number, DocLu[]>();
  docs.forEach((d, i) => groupes.set(racine(i), [...(groupes.get(racine(i)) ?? []), d]));
  return [...groupes.values()];
}

/** Quel type de document fait foi, champ par champ (le premier qui a une valeur l'emporte). */
const PRIORITE: Record<ChampContrat, string[]> = {
  employeur_nom: ["contrat", "fiche_paie", "aem", "autre"],
  employeur_siret: ["fiche_paie", "aem", "contrat", "autre"],
  employeur_numero_objet: ["aem", "contrat", "fiche_paie", "autre"],
  employeur_adresse: ["contrat", "fiche_paie", "aem", "autre"],
  projet: ["contrat", "aem", "fiche_paie", "autre"],
  poste: ["contrat", "fiche_paie", "aem", "autre"],
  annexe: ["aem", "contrat", "fiche_paie", "autre"],
  date_debut: ["contrat", "aem", "fiche_paie", "autre"],
  date_fin: ["contrat", "aem", "fiche_paie", "autre"],
  jours_travailles: ["aem", "contrat", "fiche_paie", "autre"],
  heures: ["fiche_paie", "aem", "contrat", "autre"],
  cachets: ["fiche_paie", "aem", "contrat", "autre"],
  salaire_brut: ["fiche_paie", "aem", "contrat", "autre"],
  salaire_net: ["fiche_paie", "aem", "contrat", "autre"],
};

const CHIFFRES: ChampContrat[] = ["heures", "cachets", "salaire_brut", "salaire_net", "date_debut", "date_fin"];
const LIBELLE_CHAMP: Partial<Record<ChampContrat, string>> = {
  heures: "Heures",
  cachets: "Cachets",
  salaire_brut: "Brut",
  salaire_net: "Net",
  date_debut: "Date de début",
  date_fin: "Date de fin",
};
const COURT_TYPE: Record<string, string> = { contrat: "contrat", fiche_paie: "bulletin", aem: "AEM", autre: "autre document" };
const DATES: ChampContrat[] = ["date_debut", "date_fin"];

function afficher(v: unknown) {
  return typeof v === "number" ? v.toLocaleString("fr-FR") : String(v);
}

/**
 * Fusionne les extractions d'un groupe en une seule fiche.
 * Les désaccords entre documents sont signalés (champ à vérifier + remarque).
 */
export function fusionner(groupe: DocLu[]): ContratExtraction {
  if (groupe.length === 1) return groupe[0].extraction;

  const rang = (type: string, champ: ChampContrat) => {
    const i = PRIORITE[champ].indexOf(type);
    return i < 0 ? 99 : i;
  };
  const remarques: string[] = [];
  const resultat = { ...groupe[0].extraction } as ContratExtraction;

  for (const champ of CHAMPS_CONTRAT) {
    const avecValeur = groupe
      .filter((d) => {
        const v = d.extraction[champ].valeur;
        return v !== null && !(Array.isArray(v) && v.length === 0);
      })
      .sort((a, b) => rang(a.type, champ) - rang(b.type, champ));
    if (avecValeur.length === 0) continue;

    const retenu = avecValeur[0];
    const valeur = { ...retenu.extraction[champ] } as ContratExtraction[typeof champ];

    if (CHIFFRES.includes(champ)) {
      // Un bulletin couvre souvent tout le mois : ses dates ne contredisent pas celles du contrat.
      const comparables = DATES.includes(champ) ? avecValeur.filter((d) => d.type !== "fiche_paie") : avecValeur;
      const autre = comparables.find((d) => d !== retenu && String(d.extraction[champ].valeur) !== String(valeur.valeur));
      if (autre && comparables.includes(retenu)) {
        valeur.confiance = "basse";
        remarques.push(
          `${LIBELLE_CHAMP[champ]} différent selon les documents : ${afficher(valeur.valeur)} (${COURT_TYPE[retenu.type] ?? "document"}), ` +
            `${afficher(autre.extraction[champ].valeur)} (${COURT_TYPE[autre.type] ?? "document"}).`,
        );
      }
    }
    (resultat as Record<ChampContrat, unknown>)[champ] = valeur;
  }

  const notes = groupe.map((d) => d.extraction.remarques).filter(Boolean);
  resultat.remarques = [...remarques, ...notes].join(" ") || null;
  resultat.type_document = groupe.some((d) => d.type === "contrat") ? "contrat" : groupe[0].extraction.type_document;
  return resultat;
}

/** Résumé court d'un groupe pour les listes : « Employeur · période ». */
export function resumeGroupe(e: ContratExtraction) {
  return { employeur: e.employeur_nom.valeur, debut: e.date_debut.valeur, fin: e.date_fin.valeur };
}
