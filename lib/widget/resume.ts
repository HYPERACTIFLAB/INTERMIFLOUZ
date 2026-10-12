import { appliquerModifications } from "@/lib/regles/regles";
import { allocationJournaliere, compteur, type ContratCalcul } from "@/lib/regles/intermittence";
import { estimationAuSeuil, moyennesContrats } from "@/lib/regles/objectif";
import { titreContrat } from "@/lib/titre";

/** Données brutes renvoyées par la fonction SQL donnees_widget. */
export type DonneesWidget = {
  contrats: (Omit<ContratCalcul, "heures"> & {
    heures: number | string;
    salaire_net: number | null;
    paye: boolean;
    statut_aem: string;
  })[];
  situation: { droits_ouverts: boolean; date_anniversaire: string | null } | null;
  regles: { cle: string; valeur: number | string; verifie_le: string | null }[];
};

/** Chiffres affichés par le widget (montants en euros). */
export function resumeWidget(d: DonneesWidget, jour: string) {
  const regles = appliquerModifications(d.regles.map((r) => ({ cle: r.cle, valeur: Number(r.valeur), verifie_le: r.verifie_le })));
  const contrats = d.contrats.map((c) => ({ ...c, heures: Number(c.heures), jours_travailles: c.jours_travailles ?? [] }));
  const situation = d.situation ?? { droits_ouverts: false, date_anniversaire: null };
  const r = compteur(contrats, situation, regles, jour);

  const taux = moyennesContrats(contrats).tauxHoraire;
  const auSeuil = taux ? estimationAuSeuil(r.total, r.brut / 100, taux, regles) : null;
  const are = auSeuil
    ? { montant: auSeuil.aj.finale, si507: true }
    : r.atteint
      ? { montant: allocationJournaliere(r.brut / 100, r.total, regles).finale, si507: false }
      : null;

  const nonPercus = contrats.filter((c) => !c.paye && c.date_fin <= jour);
  const enCours = contrats.find((c) => c.date_debut <= jour && c.date_fin >= jour);
  const aVenir = contrats.filter((c) => c.date_debut > jour).sort((a, b) => a.date_debut.localeCompare(b.date_debut))[0];
  const prochain = enCours ?? aVenir;

  return {
    heures: Math.round(r.total),
    seuil: r.seuil,
    atteint: r.atteint,
    manquant: Math.ceil(r.manquant),
    date_limite: r.renouvellement ? r.fin : null,
    are,
    a_percevoir: Math.round(nonPercus.reduce((s, c) => s + (c.salaire_net ?? 0), 0) / 100),
    salaires_attendus: nonPercus.length,
    aem_manquantes: contrats.filter((c) => c.statut_aem === "a_recevoir" && c.date_fin <= jour).length,
    prochain: prochain ? { titre: titreContrat(prochain), debut: prochain.date_debut, fin: prochain.date_fin, en_cours: prochain === enCours } : null,
    mis_a_jour: new Date().toISOString(),
  };
}

export type ResumeWidget = ReturnType<typeof resumeWidget>;
