"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDb } from "@/lib/data/db";
import { chargerFacture, resteDu } from "@/lib/data/micro";
import { parseEurosEnCentimes } from "@/lib/format";
import { totalLignes, type Ligne } from "@/lib/micro/calcul";
import { NOUVEAU_CLIENT } from "./constantes";

export type EtatDocument = { error?: string };

type Db = Awaited<ReturnType<typeof requireDb>>;

const vide = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

const LignesSchema = z
  .array(
    z.object({
      description: z.string().trim().min(1, "Chaque ligne doit avoir une description."),
      quantite: z.number().positive("Quantité invalide."),
      unite: z.string().trim(),
      prix_unitaire: z.number().int(),
    }),
  )
  .min(1, "Ajoute au moins une ligne.");

function rafraichir() {
  for (const p of ["/micro", "/micro/devis", "/micro/factures", "/micro/encaissements"]) revalidatePath(p);
}

/** Client choisi dans la liste, ou créé à la volée (fiche Contacts de type « client »). */
async function resoudreClient(db: Db, formData: FormData): Promise<{ id: string | null } | { error: string }> {
  const choix = vide(formData.get("organisation_id"));
  if (choix !== NOUVEAU_CLIENT) {
    if (choix) {
      // Un employeur qui devient aussi client.
      await db.supabase.from("organisations").update({ type: "les_deux" }).eq("id", choix).eq("type", "employeur");
    }
    return { id: choix };
  }
  const nom = vide(formData.get("client_nom"));
  if (!nom) return { error: "Indique le nom du nouveau client." };
  const siret = vide(formData.get("client_siret"))?.replace(/\s/g, "") ?? null;
  if (siret && !/^\d{14}$/.test(siret)) return { error: "Le SIRET du client doit comporter 14 chiffres." };
  const { data, error } = await db.supabase
    .from("organisations")
    .insert({ nom, type: "client", adresse: vide(formData.get("client_adresse")), siret, email: vide(formData.get("client_email")) })
    .select("id")
    .single();
  if (error) return { error: "Impossible de créer le client : " + error.message };
  return { id: data.id as string };
}

async function resoudreProjet(db: Db, nom: string | null, organisationId: string | null) {
  if (!nom) return null;
  const { data: existant } = await db.supabase.from("projets").select("id").ilike("nom", nom).limit(1).maybeSingle();
  if (existant) return existant.id as string;
  const { data } = await db.supabase.from("projets").insert({ nom, organisation_id: organisationId }).select("id").single();
  return (data?.id as string) ?? null;
}

/** Champs communs aux devis et factures. */
async function lireDocument(db: Db, formData: FormData) {
  let lignes: Ligne[];
  try {
    const brut = JSON.parse(String(formData.get("lignes") ?? "[]"));
    const p = LignesSchema.safeParse(brut);
    if (!p.success) return { error: p.error.issues[0].message };
    lignes = p.data;
  } catch {
    return { error: "Lignes illisibles." };
  }
  const emission = date.safeParse(formData.get("date_emission"));
  if (!emission.success) return { error: "Indique la date du document." };
  const client = await resoudreClient(db, formData);
  if ("error" in client) return { error: client.error };
  return {
    champs: {
      organisation_id: client.id,
      projet_id: await resoudreProjet(db, vide(formData.get("projet_nom")), client.id),
      objet: vide(formData.get("objet")),
      date_emission: emission.data,
      lignes,
      total: totalLignes(lignes),
      notes: vide(formData.get("notes")),
      updated_at: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Devis
// ---------------------------------------------------------------------------

export async function saveDevis(_: EtatDocument, formData: FormData): Promise<EtatDocument> {
  const db = await requireDb();
  const lu = await lireDocument(db, formData);
  if ("error" in lu) return { error: lu.error };
  const validite = vide(formData.get("date_validite"));
  const champs = { ...lu.champs, date_validite: validite };

  let id = vide(formData.get("id"));
  if (id) {
    const { error } = await db.supabase.from("devis").update(champs).eq("id", id);
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
  } else {
    const { data: numero, error: e1 } = await db.supabase.rpc("prochain_numero", { p_type: "devis", p_annee: Number(champs.date_emission.slice(0, 4)) });
    if (e1) return { error: "Numérotation impossible : " + e1.message };
    const { data, error } = await db.supabase.from("devis").insert({ ...champs, numero }).select("id").single();
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
    id = data.id as string;
  }
  rafraichir();
  redirect(`/micro/devis/${id}`);
}

export async function statutDevis(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  const statut = z.enum(["brouillon", "envoye", "accepte", "refuse"]).parse(formData.get("statut"));
  await supabase.from("devis").update({ statut, updated_at: new Date().toISOString() }).eq("id", id);
  rafraichir();
  revalidatePath(`/micro/devis/${id}`);
}

export async function supprimerDevis(formData: FormData) {
  const { supabase } = await requireDb();
  await supabase.from("devis").delete().eq("id", String(formData.get("id")));
  rafraichir();
  redirect("/micro/devis");
}

/** Crée une facture (brouillon) reprenant le devis, et marque le devis accepté. */
export async function devisEnFacture(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  const { data: d } = await supabase.from("devis").select("*").eq("id", id).maybeSingle();
  if (!d) redirect("/micro/devis");
  const { data: f, error } = await supabase
    .from("factures")
    .insert({
      devis_id: d.id,
      organisation_id: d.organisation_id,
      projet_id: d.projet_id,
      objet: d.objet,
      lignes: d.lignes,
      total: d.total,
      notes: d.notes,
      date_emission: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("devis").update({ statut: "accepte" }).eq("id", id);
  rafraichir();
  redirect(`/micro/factures/${f.id}`);
}

// ---------------------------------------------------------------------------
// Factures
// ---------------------------------------------------------------------------

export async function saveFacture(_: EtatDocument, formData: FormData): Promise<EtatDocument> {
  const db = await requireDb();
  const lu = await lireDocument(db, formData);
  if ("error" in lu) return { error: lu.error };
  const champs = { ...lu.champs, date_echeance: vide(formData.get("date_echeance")) };

  let id = vide(formData.get("id"));
  if (id) {
    // Une facture émise ne se modifie plus (obligation légale) : seuls les brouillons.
    const { data, error } = await db.supabase.from("factures").update(champs).eq("id", id).eq("statut", "brouillon").select("id");
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
    if (!data?.length) return { error: "Cette facture est déjà émise : elle ne peut plus être modifiée." };
  } else {
    const { data, error } = await db.supabase.from("factures").insert(champs).select("id").single();
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
    id = data.id as string;
  }
  rafraichir();
  redirect(`/micro/factures/${id}`);
}

export async function emettreFacture(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  const { error } = await supabase.rpc("emettre_facture", { p_id: id });
  if (error) throw new Error(error.message);
  rafraichir();
  revalidatePath(`/micro/factures/${id}`);
}

export async function supprimerFacture(formData: FormData) {
  const { supabase } = await requireDb();
  await supabase.from("factures").delete().eq("id", String(formData.get("id"))).eq("statut", "brouillon");
  rafraichir();
  redirect("/micro/factures");
}

/** Une facture émise ne se supprime pas : elle est annulée (son numéro reste utilisé). */
export async function annulerFacture(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  await supabase.from("factures").update({ statut: "annulee", updated_at: new Date().toISOString() }).eq("id", id).eq("statut", "emise");
  rafraichir();
  revalidatePath(`/micro/factures/${id}`);
}

// ---------------------------------------------------------------------------
// Encaissements
// ---------------------------------------------------------------------------

export async function enregistrerPaiement(formData: FormData) {
  const { supabase } = await requireDb();
  const factureId = String(formData.get("facture_id"));
  const facture = await chargerFacture(supabase, factureId);
  if (!facture || facture.statut === "brouillon" || facture.statut === "annulee") return;
  const montant = parseEurosEnCentimes(vide(formData.get("montant"))) ?? resteDu(facture);
  const jour = date.safeParse(formData.get("date"));
  if (montant <= 0) return;
  await supabase.from("paiements").insert({
    facture_id: factureId,
    montant,
    date: jour.success ? jour.data : new Date().toISOString().slice(0, 10),
    moyen: vide(formData.get("moyen")) ?? "virement",
  });
  if (montant >= resteDu(facture)) await supabase.from("factures").update({ statut: "payee" }).eq("id", factureId);
  rafraichir();
  revalidatePath(`/micro/factures/${factureId}`);
}

export async function supprimerPaiement(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  const { data: p } = await supabase.from("paiements").select("facture_id").eq("id", id).maybeSingle();
  await supabase.from("paiements").delete().eq("id", id);
  if (p?.facture_id) {
    // Plus entièrement payée : la facture redevient « en attente ».
    await supabase.from("factures").update({ statut: "emise" }).eq("id", p.facture_id).eq("statut", "payee");
    revalidatePath(`/micro/factures/${p.facture_id}`);
  }
  rafraichir();
}

export async function ajouterRecette(_: EtatDocument, formData: FormData): Promise<EtatDocument> {
  const libelle = vide(formData.get("libelle"));
  const montant = parseEurosEnCentimes(vide(formData.get("montant")));
  const jour = date.safeParse(formData.get("date"));
  if (!libelle) return { error: "Indique ce que tu as vendu, et à qui." };
  if (!montant || montant <= 0) return { error: "Montant invalide." };
  if (!jour.success) return { error: "Date invalide." };
  const { supabase } = await requireDb();
  const { error } = await supabase.from("paiements").insert({ libelle, montant, date: jour.data, moyen: vide(formData.get("moyen")) });
  if (error) return { error: "Impossible d'enregistrer : " + error.message };
  rafraichir();
  redirect("/micro/encaissements");
}

// ---------------------------------------------------------------------------
// Déclarations URSSAF
// ---------------------------------------------------------------------------

/** Note les mois comme déclarés à l'URSSAF (avec le chiffre d'affaires déclaré). */
export async function marquerDeclare(formData: FormData) {
  const { supabase, user } = await requireDb();
  const mois = formData.getAll("mois").map(String).filter((m) => /^\d{4}-\d{2}$/.test(m));
  const ca = formData.getAll("ca").map((c) => Number(c));
  const montant = Number(formData.get("montant"));
  if (!mois.length) return;
  await supabase.from("declarations_urssaf").upsert(
    mois.map((m, i) => ({
      user_id: user.id,
      mois: m,
      ca_declare: Number.isFinite(ca[i]) ? ca[i] : 0,
      // Le montant payé est noté sur le dernier mois de l'échéance.
      montant_paye: i === mois.length - 1 && Number.isFinite(montant) ? montant : null,
      date_declaration: new Date().toISOString().slice(0, 10),
    })),
  );
  rafraichir();
}

export async function annulerDeclaration(formData: FormData) {
  const { supabase } = await requireDb();
  const mois = formData.getAll("mois").map(String);
  await supabase.from("declarations_urssaf").delete().in("mois", mois);
  rafraichir();
}
