import { centimesVersSaisie } from "@/lib/format";
import type { Contrat } from "@/lib/data/types";
import { champsIncertains, type ChampContrat, type ContratExtraction } from "@/lib/extraction/contrat-schema";

export const NOUVELLE_ORGANISATION = "__nouvelle__";

export type ContratFormValues = {
  organisation_id: string;
  organisation_nom: string;
  organisation_siret: string;
  organisation_numero_objet: string;
  organisation_adresse: string;
  projet_nom: string;
  poste: string;
  type_contrat: "cddu" | "autre";
  annexe: "8" | "10" | "regime_general";
  date_debut: string;
  date_fin: string;
  heures: string;
  cachets: string;
  salaire_brut: string;
  salaire_net: string;
  statut_aem: "a_recevoir" | "recue" | "transmise";
  date_reception_aem: string;
  notes: string;
};

export const VALEURS_VIDES: ContratFormValues = {
  organisation_id: "",
  organisation_nom: "",
  organisation_siret: "",
  organisation_numero_objet: "",
  organisation_adresse: "",
  projet_nom: "",
  poste: "",
  type_contrat: "cddu",
  annexe: "8",
  date_debut: "",
  date_fin: "",
  heures: "",
  cachets: "",
  salaire_brut: "",
  salaire_net: "",
  statut_aem: "a_recevoir",
  date_reception_aem: "",
  notes: "",
};

/** Correspondance champ extrait → champ du formulaire (pour le surlignage orange). */
const CHAMP_FORMULAIRE: Record<ChampContrat, string> = {
  employeur_nom: "organisation",
  employeur_siret: "organisation_siret",
  employeur_numero_objet: "organisation_numero_objet",
  employeur_adresse: "organisation_adresse",
  projet: "projet_nom",
  poste: "poste",
  annexe: "annexe",
  date_debut: "date_debut",
  date_fin: "date_fin",
  jours_travailles: "jours_travailles",
  heures: "heures",
  cachets: "cachets",
  salaire_brut: "salaire_brut",
  salaire_net: "salaire_net",
};

const nombreSaisie = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const eurosSaisie = (n: number | null) => (n === null ? "" : centimesVersSaisie(Math.round(n * 100)));
const dateValide = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");

/** Transforme la lecture de Claude en valeurs de formulaire + champs à vérifier. */
export function valeursDepuisExtraction(
  e: ContratExtraction,
  organisationTrouvee: { id: string } | null,
) {
  const valeurs: ContratFormValues = {
    ...VALEURS_VIDES,
    organisation_id: organisationTrouvee?.id ?? (e.employeur_nom.valeur ? NOUVELLE_ORGANISATION : ""),
    organisation_nom: e.employeur_nom.valeur ?? "",
    organisation_siret: e.employeur_siret.valeur ?? "",
    organisation_numero_objet: e.employeur_numero_objet.valeur ?? "",
    organisation_adresse: e.employeur_adresse.valeur ?? "",
    projet_nom: e.projet.valeur ?? "",
    poste: e.poste.valeur ?? "",
    annexe: e.annexe.valeur ?? "8",
    date_debut: dateValide(e.date_debut.valeur),
    date_fin: dateValide(e.date_fin.valeur),
    heures: nombreSaisie(e.heures.valeur),
    cachets: nombreSaisie(e.cachets.valeur),
    salaire_brut: eurosSaisie(e.salaire_brut.valeur),
    salaire_net: eurosSaisie(e.salaire_net.valeur),
  };
  const incertains = champsIncertains(e).map((c) => CHAMP_FORMULAIRE[c]);
  const sources: Record<string, string> = {};
  for (const [champ, nomFormulaire] of Object.entries(CHAMP_FORMULAIRE)) {
    const s = e[champ as ChampContrat].source;
    if (s) sources[nomFormulaire] = s;
  }
  const jours = (e.jours_travailles.valeur ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  return { valeurs, incertains, sources, jours };
}

export function valeursDepuisContrat(c: Contrat): ContratFormValues {
  return {
    ...VALEURS_VIDES,
    organisation_id: c.organisation_id ?? "",
    projet_nom: c.projet?.nom ?? "",
    poste: c.poste ?? "",
    type_contrat: c.type_contrat,
    annexe: c.annexe,
    date_debut: c.date_debut,
    date_fin: c.date_fin,
    heures: nombreSaisie(Number(c.heures)),
    cachets: nombreSaisie(c.cachets),
    salaire_brut: centimesVersSaisie(c.salaire_brut),
    salaire_net: centimesVersSaisie(c.salaire_net),
    statut_aem: c.statut_aem,
    date_reception_aem: c.date_reception_aem ?? "",
    notes: c.notes ?? "",
  };
}
