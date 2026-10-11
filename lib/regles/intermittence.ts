import { v, type Regles } from "./regles";
import { ajouterJours, ajouterMois, bornesMois, joursInclus, maxIso, minIso } from "./dates";

/** Ce dont le moteur a besoin d'un contrat (montants en centimes). */
export type ContratCalcul = {
  id: string;
  date_debut: string;
  date_fin: string;
  heures: number;
  cachets: number;
  salaire_brut: number | null;
  jours_travailles?: string[];
  employeur?: string | null;
  projet?: string | null;
  poste?: string | null;
  annexe?: string;
};

export type Part = {
  contrat: ContratCalcul;
  /** Part du contrat comprise dans la période (0 à 1). */
  part: number;
  heures: number;
  brut: number;
};

/** Heures retenues d'un contrat : heures + cachets convertis. */
export function heuresRetenues(c: ContratCalcul, regles: Regles) {
  return Number(c.heures) + c.cachets * v(regles, "cachet_heures");
}

/**
 * Part d'un contrat comprise dans une période. Si les jours travaillés sont connus,
 * on compte ceux de la période ; sinon on répartit au prorata des jours calendaires.
 */
export function partDansPeriode(c: ContratCalcul, debut: string, fin: string) {
  if (c.jours_travailles?.length) {
    const dedans = c.jours_travailles.filter((j) => j >= debut && j <= fin).length;
    return dedans / c.jours_travailles.length;
  }
  const d = maxIso(c.date_debut, debut);
  const f = minIso(c.date_fin, fin);
  if (d > f) return 0;
  return joursInclus(d, f) / joursInclus(c.date_debut, c.date_fin);
}

/** Heures et salaires (centimes) retenus sur une période. Seuls les contrats annexe 8 / 10 comptent. */
export function cumulPeriode(contrats: ContratCalcul[], debut: string, fin: string, regles: Regles) {
  const parts: Part[] = [];
  for (const c of contrats) {
    if (c.annexe === "regime_general") continue;
    const part = partDansPeriode(c, debut, fin);
    if (part <= 0) continue;
    parts.push({ contrat: c, part, heures: heuresRetenues(c, regles) * part, brut: (c.salaire_brut ?? 0) * part });
  }
  return {
    parts,
    heures: arrondi(parts.reduce((s, p) => s + p.heures, 0)),
    brut: Math.round(parts.reduce((s, p) => s + p.brut, 0)),
    sansSalaire: parts.filter((p) => p.contrat.salaire_brut === null).length,
  };
}

const arrondi = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

export type Situation = { droits_ouverts: boolean; date_anniversaire: string | null };

/**
 * Compteur vers les 507 h.
 * - Droits ouverts : période = 12 mois avant la date anniversaire (renouvellement).
 * - Sinon : période = 12 mois jusqu'à aujourd'hui (« si tu t'inscrivais aujourd'hui »).
 */
export function compteur(contrats: ContratCalcul[], situation: Situation, regles: Regles, aujourdhui: string) {
  const seuil = v(regles, "seuil_heures");
  const duree = v(regles, "periode_reference_jours");
  const renouvellement = situation.droits_ouverts && !!situation.date_anniversaire;
  const fin = renouvellement ? situation.date_anniversaire! : aujourdhui;
  const debut = ajouterJours(fin, -(duree - 1));

  // Heures déjà acquises (jusqu'à aujourd'hui) dans la période.
  const acquis = cumulPeriode(contrats, debut, minIso(fin, aujourdhui), regles);
  // Contrats déjà signés mais pas encore terminés (ou à venir) dans la période.
  const prevu = renouvellement && fin > aujourdhui ? cumulPeriode(contrats, ajouterJours(aujourdhui, 1), fin, regles) : null;

  const heures = acquis.heures;
  const total = arrondi(heures + (prevu?.heures ?? 0));
  return {
    seuil,
    debut,
    fin,
    renouvellement,
    heures,
    heuresPrevues: prevu?.heures ?? 0,
    total,
    manquant: Math.max(0, arrondi(seuil - total)),
    atteint: total >= seuil,
    brut: acquis.brut + (prevu?.brut ?? 0),
    parts: [...acquis.parts, ...(prevu?.parts ?? [])],
    sansSalaire: acquis.sansSalaire,
    projection: projection(contrats, regles, aujourdhui, { seuil, total, fin: renouvellement ? fin : null }),
  };
}

/**
 * Projection au rythme des 6 derniers mois.
 * Renvoie le rythme mensuel, et soit la date estimée d'atteinte, soit le total estimé à la date anniversaire.
 */
export function projection(
  contrats: ContratCalcul[],
  regles: Regles,
  aujourdhui: string,
  cible: { seuil: number; total: number; fin: string | null },
) {
  const depuis = ajouterMois(aujourdhui, -6);
  const recents = cumulPeriode(contrats, ajouterJours(depuis, 1), aujourdhui, regles).heures;
  const parJour = recents / joursInclus(ajouterJours(depuis, 1), aujourdhui);
  const parMois = arrondi(parJour * 30.44, 0);
  const manquant = Math.max(0, cible.seuil - cible.total);

  if (cible.fin) {
    const reste = cible.fin > aujourdhui ? joursInclus(aujourdhui, cible.fin) - 1 : 0;
    const estimeALaDate = arrondi(cible.total + parJour * reste, 0);
    return { parMois, dateEstimee: null as string | null, estimeALaDate };
  }
  if (manquant === 0) return { parMois, dateEstimee: aujourdhui, estimeALaDate: null as number | null };
  if (parJour <= 0) return { parMois, dateEstimee: null as string | null, estimeALaDate: null as number | null };
  return { parMois, dateEstimee: ajouterJours(aujourdhui, Math.ceil(manquant / parJour)), estimeALaDate: null as number | null };
}

/**
 * Allocation journalière estimée (annexe 8) : A + B + C, bornée par le plancher et le plafond.
 * `salaireReference` en euros, `heures` = heures retenues sur la période.
 */
export function allocationJournaliere(salaireReference: number, heures: number, regles: Regles) {
  const aj = v(regles, "aj_minimale");
  const seuilSr = v(regles, "a_seuil_salaire");
  const seuilH = v(regles, "b_seuil_heures");
  const A =
    (aj * (v(regles, "a_coef_tranche1") * Math.min(salaireReference, seuilSr) +
      v(regles, "a_coef_tranche2") * Math.max(0, salaireReference - seuilSr))) /
    v(regles, "a_diviseur");
  const B =
    (aj * (v(regles, "b_coef_tranche1") * Math.min(heures, seuilH) + v(regles, "b_coef_tranche2") * Math.max(0, heures - seuilH))) /
    v(regles, "b_diviseur");
  const C = aj * v(regles, "c_coef");
  const brute = A + B + C;
  const plancher = v(regles, "aj_plancher");
  const plafond = v(regles, "aj_plafond");
  const finale = Math.min(plafond, Math.max(plancher, brute));
  return {
    A: arrondi(A),
    B: arrondi(B),
    C: arrondi(C),
    brute: arrondi(brute),
    finale: arrondi(finale),
    borne: brute < plancher ? ("plancher" as const) : brute > plafond ? ("plafond" as const) : null,
  };
}

/** Récap d'un mois pour l'actualisation France Travail. */
export function recapMois(contrats: ContratCalcul[], mois: string, regles: Regles) {
  const { debut, fin } = bornesMois(mois);
  const cumul = cumulPeriode(contrats, debut, fin, regles);
  const lignes = cumul.parts.map((p) => {
    const c = p.contrat;
    const jours = c.jours_travailles?.length
      ? c.jours_travailles.filter((j) => j >= debut && j <= fin).length
      : joursInclus(maxIso(c.date_debut, debut), minIso(c.date_fin, fin));
    return {
      contrat: c,
      debut: maxIso(c.date_debut, debut),
      fin: minIso(c.date_fin, fin),
      jours,
      heures: arrondi(p.heures),
      brut: Math.round(p.brut),
      partiel: p.part < 1,
    };
  });
  const employeurs = [...new Set(lignes.map((l) => l.contrat.employeur).filter(Boolean))] as string[];
  return { debut, fin, lignes, employeurs, heures: cumul.heures, brut: cumul.brut, jours: lignes.reduce((s, l) => s + l.jours, 0) };
}
