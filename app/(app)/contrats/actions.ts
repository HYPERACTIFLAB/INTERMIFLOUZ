"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDb } from "@/lib/data/db";
import { parseEurosEnCentimes, parseNombre } from "@/lib/format";
import { SUPPORTED_MIME, extractionEnabled } from "@/lib/extraction/config";
import { lancerExtraction } from "@/lib/extraction/run";
import type { DocumentType } from "@/lib/data/types";

export type FormState = { error?: string };

const NOUVELLE = "__nouvelle__";
const dateIso = /^\d{4}-\d{2}-\d{2}$/;

const vide = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

function jsonListe(v: FormDataEntryValue | null): string[] {
  try {
    const parsed = JSON.parse(String(v ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const ContratSchema = z
  .object({
    poste: z.string().nullable(),
    type_contrat: z.enum(["cddu", "autre"]),
    annexe: z.enum(["8", "10", "regime_general"]),
    date_debut: z.string().regex(dateIso, "La date de début est obligatoire."),
    date_fin: z.string().regex(dateIso, "La date de fin est obligatoire."),
    heures: z.number().min(0, "Les heures ne peuvent pas être négatives."),
    cachets: z.number().int("Le nombre de cachets doit être entier.").min(0),
    salaire_brut: z.number().int().nullable(),
    salaire_net: z.number().int().nullable(),
    statut_aem: z.enum(["a_recevoir", "recue", "transmise"]),
    date_reception_aem: z.string().regex(dateIso).nullable(),
    notes: z.string().nullable(),
    jours_travailles: z.array(z.string().regex(dateIso)),
    champs_incertains: z.array(z.string()),
    source: z.enum(["manuel", "import_ia"]),
  })
  .refine((c) => c.date_fin >= c.date_debut, "La date de fin est avant la date de début.");

type Db = Awaited<ReturnType<typeof requireDb>>;

/** Trouve l'employeur choisi, ou le crée s'il est nouveau. */
async function resoudreOrganisation({ supabase }: Db, formData: FormData) {
  const choix = vide(formData.get("organisation_id"));
  if (choix && choix !== NOUVELLE) return { id: choix };

  const nom = vide(formData.get("organisation_nom"));
  if (!nom) return choix === NOUVELLE ? { error: "Indique le nom de la nouvelle société." } : { id: null };

  const siret = vide(formData.get("organisation_siret"))?.replace(/\s/g, "") ?? null;
  const { data, error } = await supabase
    .from("organisations")
    .insert({
      nom,
      type: "employeur",
      siret: siret && /^\d{14}$/.test(siret) ? siret : null,
      numero_objet: vide(formData.get("organisation_numero_objet")),
      adresse: vide(formData.get("organisation_adresse")),
    })
    .select("id")
    .single();
  if (error) return { error: "Impossible de créer la société : " + error.message };
  return { id: data.id as string };
}

/** Trouve le projet par son nom (sans tenir compte des majuscules), ou le crée. */
async function resoudreProjet({ supabase }: Db, nom: string | null, organisationId: string | null) {
  if (!nom) return null;
  const { data: existant } = await supabase.from("projets").select("id").ilike("nom", nom).limit(1).maybeSingle();
  if (existant) return existant.id as string;
  const { data } = await supabase
    .from("projets")
    .insert({ nom, organisation_id: organisationId })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

export async function saveContrat(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = ContratSchema.safeParse({
    poste: vide(formData.get("poste")),
    type_contrat: formData.get("type_contrat"),
    annexe: formData.get("annexe"),
    date_debut: formData.get("date_debut"),
    date_fin: formData.get("date_fin"),
    heures: parseNombre(vide(formData.get("heures"))) ?? 0,
    cachets: parseNombre(vide(formData.get("cachets"))) ?? 0,
    salaire_brut: parseEurosEnCentimes(vide(formData.get("salaire_brut"))),
    salaire_net: parseEurosEnCentimes(vide(formData.get("salaire_net"))),
    statut_aem: formData.get("statut_aem"),
    date_reception_aem: vide(formData.get("date_reception_aem")),
    notes: vide(formData.get("notes")),
    jours_travailles: jsonListe(formData.get("jours_travailles")),
    champs_incertains: jsonListe(formData.get("champs_incertains")),
    source: formData.get("source") === "import_ia" ? "import_ia" : "manuel",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await requireDb();
  const org = await resoudreOrganisation(db, formData);
  if ("error" in org) return { error: org.error };
  const projetId = await resoudreProjet(db, vide(formData.get("projet_nom")), org.id);

  const contrat = {
    ...parsed.data,
    // Une fois le contrat validé par toi, plus rien n'est « incertain ».
    champs_incertains: [],
    organisation_id: org.id,
    projet_id: projetId,
    contact_id: vide(formData.get("contact_id")),
  };

  const id = vide(formData.get("id"));
  let contratId = id;
  if (id) {
    const { error } = await db.supabase.from("contrats").update(contrat).eq("id", id);
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
  } else {
    const { data, error } = await db.supabase.from("contrats").insert(contrat).select("id").single();
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
    contratId = data.id as string;
  }

  const documentId = vide(formData.get("document_id"));
  if (documentId) {
    await db.supabase
      .from("documents")
      .update({ contrat_id: contratId, extraction_statut: "validee" })
      .eq("id", documentId);
  }

  revalidatePath("/contrats");
  revalidatePath("/contacts");
  redirect(`/contrats/${contratId}`);
}

export async function updateStatutAem(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  const statut = z.enum(["a_recevoir", "recue", "transmise"]).parse(formData.get("statut_aem"));
  const { data: actuel } = await supabase.from("contrats").select("date_reception_aem").eq("id", id).maybeSingle();
  const date_reception_aem =
    statut === "a_recevoir" ? null : (actuel?.date_reception_aem ?? new Date().toISOString().slice(0, 10));
  await supabase.from("contrats").update({ statut_aem: statut, date_reception_aem }).eq("id", id);
  revalidatePath("/contrats");
  revalidatePath(`/contrats/${id}`);
}

export async function deleteContrat(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  const { data: docs } = await supabase.from("documents").select("id, chemin_stockage").eq("contrat_id", id);
  if (docs?.length) {
    await supabase.storage.from("documents").remove(docs.map((d) => d.chemin_stockage as string));
    await supabase.from("documents").delete().in("id", docs.map((d) => d.id as string));
  }
  await supabase.from("contrats").delete().eq("id", id);
  revalidatePath("/contrats");
  redirect("/contrats");
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const DocumentSchema = z.object({
  chemin: z.string().min(1),
  nomFichier: z.string().min(1).max(255),
  mime: z.enum(SUPPORTED_MIME),
  taille: z.number().int().min(0),
  type: z.enum(["contrat", "fiche_paie", "aem", "autre"]),
  contratId: z.string().uuid().nullable().optional(),
});

export type NouveauDocument = z.infer<typeof DocumentSchema>;

/** Enregistre un fichier déjà déposé dans le stockage. Le chemin doit être dans le dossier de l'utilisateur. */
async function enregistrerDocument(input: NouveauDocument) {
  const doc = DocumentSchema.parse(input);
  const db = await requireDb();
  if (!doc.chemin.startsWith(`${db.user.id}/`)) throw new Error("Chemin de fichier invalide.");

  const { data, error } = await db.supabase
    .from("documents")
    .insert({
      chemin_stockage: doc.chemin,
      nom_fichier: doc.nomFichier,
      mime: doc.mime,
      taille: doc.taille,
      type: doc.type as DocumentType,
      contrat_id: doc.contratId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error("Impossible d'enregistrer le document : " + error.message);
  return { db, doc, documentId: data.id as string };
}

/**
 * Après le dépôt d'un PDF ou d'une photo : crée la fiche document.
 * `lecture` indique si une lecture par Claude doit être lancée (clé configurée).
 */
export async function creerDocumentImport(
  input: NouveauDocument,
): Promise<{ documentId?: string; lecture?: boolean; error?: string }> {
  try {
    const { db, documentId } = await enregistrerDocument(input);
    const lecture = extractionEnabled();
    if (lecture) await db.supabase.from("documents").update({ extraction_statut: "en_cours" }).eq("id", documentId);
    return { documentId, lecture };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue." };
  }
}

/**
 * Lecture par Claude directement dans l'action serveur. Sert hors Netlify
 * (développement local), là où la tâche de fond n'existe pas.
 */
export async function extraireMaintenant(documentId: string) {
  if (!extractionEnabled()) return;
  const { supabase } = await requireDb();
  await lancerExtraction(supabase, z.string().uuid().parse(documentId));
}

/** Rattache un fichier supplémentaire (fiche de paie, AEM…) à un contrat existant. */
export async function ajouterDocument(input: NouveauDocument): Promise<{ error?: string }> {
  try {
    const { doc } = await enregistrerDocument(input);
    revalidatePath(`/contrats/${doc.contratId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue." };
  }
}

export async function deleteDocument(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  const { data: doc } = await supabase.from("documents").select("chemin_stockage, contrat_id").eq("id", id).maybeSingle();
  if (!doc) return;
  await supabase.storage.from("documents").remove([doc.chemin_stockage as string]);
  await supabase.from("documents").delete().eq("id", id);
  if (doc.contrat_id) revalidatePath(`/contrats/${doc.contrat_id}`);
  revalidatePath("/contrats");
}

/** Abandonne un import pas encore validé (supprime le fichier). */
export async function abandonnerImport(formData: FormData) {
  await deleteDocument(formData);
  redirect("/contrats");
}

/** Remet un document en attente de lecture (bouton « Relancer la lecture »). */
export async function preparerRelance(documentId: string): Promise<{ error?: string }> {
  if (!extractionEnabled()) return { error: "La lecture automatique n'est pas configurée." };
  const { supabase } = await requireDb();
  const { error } = await supabase
    .from("documents")
    .update({ extraction_statut: "en_cours", extraction_erreur: null })
    .eq("id", z.string().uuid().parse(documentId))
    .is("contrat_id", null);
  return error ? { error: error.message } : {};
}
