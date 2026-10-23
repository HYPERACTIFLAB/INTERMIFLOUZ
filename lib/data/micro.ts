import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ligne } from "@/lib/micro/calcul";

export type Entreprise = {
  nom: string | null;
  nom_commercial: string | null;
  activite: string | null;
  siret: string | null;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
  iban: string | null;
  bic: string | null;
  date_debut_activite: string | null;
  mention_tva: string;
  conditions_paiement: string;
  penalites_retard: string;
};

export const ENTREPRISE_VIDE: Entreprise = {
  nom: null,
  nom_commercial: null,
  activite: null,
  siret: null,
  adresse: null,
  email: null,
  telephone: null,
  iban: null,
  bic: null,
  // Début d'activité indiqué à l'URSSAF (modifiable dans Paramètres).
  date_debut_activite: "2026-08-12",
  mention_tva: "TVA non applicable, art. 293 B du CGI",
  conditions_paiement: "Paiement à 30 jours par virement bancaire.",
  penalites_retard:
    "En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.",
};

export async function chargerEntreprise(supabase: SupabaseClient): Promise<Entreprise> {
  const { data } = await supabase.from("parametres_entreprise").select("*").maybeSingle();
  return data ? { ...ENTREPRISE_VIDE, ...data, date_debut_activite: data.date_debut_activite ?? ENTREPRISE_VIDE.date_debut_activite } : ENTREPRISE_VIDE;
}

/** Champs indispensables sur une facture : ce qui manque est listé. */
export function infosManquantes(e: Entreprise) {
  return [
    !e.nom && "ton nom",
    !e.siret && "ton SIRET",
    !e.adresse && "ton adresse",
  ].filter(Boolean) as string[];
}

export type Client = { id: string; nom: string; adresse: string | null; siret: string | null; email: string | null } | null;

type Base = {
  id: string;
  numero: string | null;
  objet: string | null;
  date_emission: string | null;
  lignes: Ligne[];
  total: number;
  notes: string | null;
  organisation_id: string | null;
  projet_id: string | null;
  client: Client;
  projet: { id: string; nom: string } | null;
};

export type Devis = Base & { numero: string; date_validite: string | null; statut: "brouillon" | "envoye" | "accepte" | "refuse" };
export type Facture = Base & {
  date_echeance: string | null;
  statut: "brouillon" | "emise" | "payee" | "annulee";
  devis_id: string | null;
  paiements: { id: string; date: string; montant: number; moyen: string | null }[];
};

const RELATIONS = "client:organisations(id, nom, adresse, siret, email), projet:projets(id, nom)";

export async function listDevis(supabase: SupabaseClient) {
  const { data } = await supabase.from("devis").select(`*, ${RELATIONS}`).order("date_emission", { ascending: false }).order("numero", { ascending: false });
  return (data ?? []) as Devis[];
}

export async function chargerDevis(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("devis").select(`*, ${RELATIONS}`).eq("id", id).maybeSingle();
  return data as Devis | null;
}

export async function listFactures(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("factures")
    .select(`*, ${RELATIONS}, paiements(id, date, montant, moyen)`)
    .order("created_at", { ascending: false });
  return (data ?? []) as Facture[];
}

export async function chargerFacture(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("factures")
    .select(`*, ${RELATIONS}, paiements(id, date, montant, moyen)`)
    .eq("id", id)
    .maybeSingle();
  return data as Facture | null;
}

export const resteDu = (f: Facture) => Math.max(0, f.total - f.paiements.reduce((s, p) => s + p.montant, 0));

export type Paiement = {
  id: string;
  date: string;
  montant: number;
  moyen: string | null;
  libelle: string | null;
  facture: { id: string; numero: string | null; objet: string | null; client: { nom: string } | null } | null;
};

export async function listPaiements(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("paiements")
    .select("id, date, montant, moyen, libelle, facture:factures(id, numero, objet, client:organisations(nom))")
    .order("date", { ascending: false });
  return (data ?? []) as unknown as Paiement[];
}

export async function moisDeclares(supabase: SupabaseClient) {
  const { data } = await supabase.from("declarations_urssaf").select("mois, ca_declare, montant_paye, date_declaration");
  return (data ?? []) as { mois: string; ca_declare: number; montant_paye: number | null; date_declaration: string }[];
}

export const LIBELLES_STATUT_DEVIS: Record<Devis["statut"], string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
};

export const LIBELLES_STATUT_FACTURE: Record<Facture["statut"] | "en_retard", string> = {
  brouillon: "Brouillon",
  emise: "En attente de paiement",
  payee: "Payée",
  annulee: "Annulée",
  en_retard: "En retard",
};
