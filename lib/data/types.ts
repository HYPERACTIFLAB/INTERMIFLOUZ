export type Organisation = {
  id: string;
  nom: string;
  type: "employeur" | "client" | "les_deux";
  siret: string | null;
  numero_objet: string | null;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
  notes: string | null;
};

export type Contact = {
  id: string;
  organisation_id: string | null;
  prenom: string | null;
  nom: string | null;
  fonction: string | null;
  email: string | null;
  telephone: string | null;
  notes: string | null;
};

export type Projet = { id: string; nom: string; organisation_id: string | null };

export type StatutAem = "a_recevoir" | "recue" | "transmise";

export type Contrat = {
  id: string;
  organisation_id: string | null;
  contact_id: string | null;
  projet_id: string | null;
  poste: string | null;
  type_contrat: "cddu" | "autre";
  annexe: "8" | "10" | "regime_general";
  date_debut: string;
  date_fin: string;
  jours_travailles: string[];
  heures: number;
  cachets: number;
  salaire_brut: number | null;
  salaire_net: number | null;
  statut_aem: StatutAem;
  date_reception_aem: string | null;
  source: "manuel" | "import_ia";
  paye: boolean;
  date_paiement: string | null;
  champs_incertains: string[];
  notes: string | null;
  organisation?: Pick<Organisation, "id" | "nom"> | null;
  projet?: Pick<Projet, "id" | "nom"> | null;
};

export type DocumentType = "contrat" | "fiche_paie" | "aem" | "justificatif" | "devis_pdf" | "facture_pdf" | "autre";

export type DocumentRow = {
  id: string;
  type: DocumentType;
  chemin_stockage: string;
  nom_fichier: string;
  mime: string;
  taille: number;
  contrat_id: string | null;
  extraction_brute: unknown;
  extraction_statut: "aucune" | "en_cours" | "a_valider" | "validee" | "erreur";
  extraction_erreur: string | null;
  created_at: string;
};

export const LIBELLES_AEM: Record<StatutAem, string> = {
  a_recevoir: "AEM à recevoir",
  recue: "AEM reçue",
  transmise: "AEM transmise",
};

export const LIBELLES_DOCUMENT: Record<DocumentType, string> = {
  contrat: "Contrat",
  fiche_paie: "Fiche de paie",
  aem: "AEM",
  justificatif: "Justificatif",
  devis_pdf: "Devis",
  facture_pdf: "Facture",
  autre: "Autre",
};

export const LIBELLES_ANNEXE = { "8": "Annexe 8 (technicien)", "10": "Annexe 10 (artiste)", regime_general: "Régime général" };

export const LIBELLES_TYPE_ORGANISATION = { employeur: "Employeur", client: "Client", les_deux: "Employeur et client" };
