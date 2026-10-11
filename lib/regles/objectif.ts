import { v, type Regles } from "./regles";
import { allocationJournaliere, type ContratCalcul } from "./intermittence";

/** Montant de l'allocation pour un total d'heures et de salaires bruts (euros). */
const aj = (brut: number, heures: number, regles: Regles) => allocationJournaliere(brut, heures, regles).finale;

/** Plus petite valeur x (entre 0 et max) telle que ok(x), par dichotomie. ok doit être croissante. */
function chercher(ok: (x: number) => boolean, max: number) {
  if (!ok(max)) return null;
  let bas = 0;
  let haut = max;
  for (let i = 0; i < 60; i++) {
    const milieu = (bas + haut) / 2;
    if (ok(milieu)) haut = milieu;
    else bas = milieu;
  }
  return haut;
}

export type ObjectifEntree = {
  /** Allocation journalière visée (€). */
  cible: number;
  /** Heures déjà retenues sur la période (y compris contrats à venir). */
  heures: number;
  /** Salaires bruts déjà retenus sur la période (€). */
  brut: number;
  /** Salaire brut horaire des prochains contrats (€/h). */
  tauxHoraire: number;
  /** Heures déclarées par jour de travail. */
  heuresParJour: number;
};

/**
 * Ce qu'il reste à faire pour atteindre une allocation journalière cible.
 * On suppose que les prochains contrats sont payés `tauxHoraire` €/h ; on cherche le nombre
 * d'heures en plus (au moins ce qui manque pour les 507 h) qui donne l'allocation visée.
 */
export function objectifAllocation(e: ObjectifEntree, regles: Regles) {
  const seuil = v(regles, "seuil_heures");
  const plafond = v(regles, "aj_plafond");
  const plancher = v(regles, "aj_plancher");
  const actuelle = aj(e.brut, e.heures, regles);
  const heuresMin = Math.max(0, seuil - e.heures);
  const base = { actuelle, plafond, plancher, heuresMin, seuilAtteint: e.heures >= seuil };

  if (e.cible > plafond) return { ...base, statut: "au_dessus_plafond" as const };
  if (heuresMin === 0 && actuelle >= e.cible) return { ...base, statut: "atteint" as const };

  const avec = (h: number) => aj(e.brut + h * e.tauxHoraire, e.heures + h, regles);
  // 4 000 h en plus : bien au-delà d'une année de travail, au-delà on considère l'objectif hors d'atteinte.
  const trouve = chercher((h) => h >= heuresMin && avec(h) >= e.cible, heuresMin + 4000);
  if (trouve === null) return { ...base, statut: "hors_atteinte" as const, maxAvecTaux: avec(heuresMin + 4000) };

  const heures = Math.ceil(Math.max(heuresMin, trouve));
  const jours = e.heuresParJour > 0 ? Math.ceil(heures / e.heuresParJour) : null;
  // Si les 507 h ne sont pas atteintes : combien doivent rapporter les seules heures manquantes ?
  let tauxSiHeuresMin: number | null = null;
  if (heuresMin > 0) {
    const s = chercher((x) => aj(e.brut + x, e.heures + heuresMin, regles) >= e.cible, 1_000_000);
    if (s !== null) tauxSiHeuresMin = Math.ceil((s / heuresMin) * 100) / 100;
  }
  return {
    ...base,
    statut: "a_faire" as const,
    heures,
    jours,
    brut: Math.round(heures * e.tauxHoraire),
    totalHeures: Math.round(e.heures + heures),
    totalBrut: Math.round(e.brut + heures * e.tauxHoraire),
    tauxSiHeuresMin,
    /** Combien un jour de travail de plus ajoute à l'allocation (€/jour), au point de départ. */
    gainParJour: e.heuresParJour > 0 ? Math.round((avec(heuresMin + e.heuresParJour) - avec(heuresMin)) * 100) / 100 : null,
  };
}

/** Salaire brut horaire moyen (€/h) et heures moyennes par jour travaillé, d'après les contrats. */
export function moyennesContrats(contrats: ContratCalcul[]) {
  const payes = contrats.filter((c) => c.annexe !== "regime_general" && c.salaire_brut !== null && Number(c.heures) > 0);
  const heures = payes.reduce((s, c) => s + Number(c.heures), 0);
  const brut = payes.reduce((s, c) => s + (c.salaire_brut ?? 0), 0) / 100;
  const avecJours = contrats.filter((c) => c.jours_travailles?.length && Number(c.heures) > 0);
  const nbJours = avecJours.reduce((s, c) => s + c.jours_travailles!.length, 0);
  return {
    tauxHoraire: heures > 0 ? Math.round((brut / heures) * 100) / 100 : null,
    heuresParJour: nbJours > 0 ? Math.round((avecJours.reduce((s, c) => s + Number(c.heures), 0) / nbJours) * 10) / 10 : null,
  };
}
