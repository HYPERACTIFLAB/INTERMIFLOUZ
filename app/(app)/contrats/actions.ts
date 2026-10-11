"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDb } from "@/lib/data/db";
import { parseEurosEnCentimes, parseNombre } from "@/lib/format";
import { SUPPORTED_MIME, extractionEnabled } from "@/lib/extraction/config";
import { lancerExtraction } from "@/lib/extraction/run";
import { chargerLots } from "@/lib/data/imports";
import { fusionner, lireExtraction, type DocLu } from "@/lib/extraction/regroupement";
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

  const documentIds = idsDocuments(formData);
  let suivant: string | null = null;
  if (documentIds.length) {
    await db.supabase
      .from("documents")
      .update({ contrat_id: contratId, extraction_statut: "validee" })
      .in("id", documentIds);
    await marquerAemRecue(db.supabase, contratId!, documentIds);
    suivant = await lotSuivant(db.supabase);
  }

  revalidatePath("/contrats");
  revalidatePath("/contacts");
  redirect(suivant ? `/contrats/importer/${suivant}?suite=1` : `/contrats/${contratId}`);
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
    const { db, doc, documentId } = await enregistrerDocument(input);
    if (doc.contratId) await marquerAemRecue(db.supabase, doc.contratId, [documentId]);
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

/** Abandonne un import pas encore validé (supprime le ou les fichiers du lot). */
export async function abandonnerImport(formData: FormData) {
  const { supabase } = await requireDb();
  const ids = idsDocuments(formData);
  const { data: docs } = await supabase
    .from("documents")
    .select("id, chemin_stockage")
    .in("id", ids)
    .is("contrat_id", null);
  if (docs?.length) {
    await supabase.storage.from("documents").remove(docs.map((d) => d.chemin_stockage as string));
    await supabase.from("documents").delete().in("id", docs.map((d) => d.id as string));
  }
  revalidatePath("/contrats");
  const suivant = await lotSuivant(supabase);
  redirect(suivant ? `/contrats/importer/${suivant}` : "/contrats");
}

/**
 * Rattache les documents d'un lot à un contrat déjà enregistré (ex. l'AEM arrive après coup)
 * et complète les montants manquants du contrat avec ce qu'ils contiennent.
 */
export async function rattacherAuContrat(formData: FormData) {
  const { supabase } = await requireDb();
  const contratId = z.string().uuid().parse(formData.get("contrat_id"));
  const ids = idsDocuments(formData);

  const [{ data: contrat }, { data: docs }] = await Promise.all([
    supabase.from("contrats").select("heures, cachets, salaire_brut, salaire_net").eq("id", contratId).maybeSingle(),
    supabase.from("documents").select("id, type, nom_fichier, extraction_brute").in("id", ids).is("contrat_id", null),
  ]);
  if (!contrat || !docs?.length) redirect("/contrats");

  const lus = docs
    .map((d) => ({ id: d.id as string, type: d.type as string, nom_fichier: d.nom_fichier as string, extraction: lireExtraction(d.extraction_brute) }))
    .filter((d): d is DocLu => d.extraction !== null);
  if (lus.length) {
    const e = fusionner(lus);
    const complement: Record<string, number> = {};
    if (contrat.salaire_brut === null && e.salaire_brut.valeur !== null) complement.salaire_brut = Math.round(e.salaire_brut.valeur * 100);
    if (contrat.salaire_net === null && e.salaire_net.valeur !== null) complement.salaire_net = Math.round(e.salaire_net.valeur * 100);
    if (Number(contrat.heures) === 0 && e.heures.valeur) complement.heures = e.heures.valeur;
    if (contrat.cachets === 0 && e.cachets.valeur) complement.cachets = Math.round(e.cachets.valeur);
    if (Object.keys(complement).length) await supabase.from("contrats").update(complement).eq("id", contratId);
  }

  await supabase
    .from("documents")
    .update({ contrat_id: contratId, extraction_statut: "validee" })
    .in("id", docs.map((d) => d.id as string));
  await marquerAemRecue(supabase, contratId, docs.map((d) => d.id as string));

  revalidatePath("/contrats");
  revalidatePath(`/contrats/${contratId}`);
  const suivant = await lotSuivant(supabase);
  redirect(suivant ? `/contrats/importer/${suivant}?suite=1` : `/contrats/${contratId}`);
}

/**
 * Des documents viennent d'être rattachés à un contrat :
 * une AEM → « AEM reçue » ; un bulletin de paie → salaire considéré comme perçu.
 */
async function marquerAemRecue(supabase: Db["supabase"], contratId: string, documentIds: string[]) {
  if (!documentIds.length) return;
  const { data: docs } = await supabase.from("documents").select("type").in("id", documentIds);
  const types = new Set((docs ?? []).map((d) => d.type as string));
  const jour = new Date().toISOString().slice(0, 10);
  if (types.has("aem")) {
    await supabase
      .from("contrats")
      .update({ statut_aem: "recue", date_reception_aem: jour })
      .eq("id", contratId)
      .eq("statut_aem", "a_recevoir");
  }
  if (types.has("fiche_paie")) {
    await supabase.from("contrats").update({ paye: true, date_paiement: jour }).eq("id", contratId).eq("paye", false);
  }
}

/** Salaire perçu / pas encore perçu. */
export async function marquerPaye(formData: FormData) {
  const { supabase } = await requireDb();
  const id = z.string().uuid().parse(formData.get("id"));
  const paye = formData.get("paye") === "1";
  await supabase
    .from("contrats")
    .update({ paye, date_paiement: paye ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  revalidatePath("/");
  revalidatePath("/contrats");
  revalidatePath(`/contrats/${id}`);
}

/** Identifiants de documents envoyés par un formulaire (cases à cocher ou champ caché). */
function idsDocuments(formData: FormData) {
  return formData
    .getAll("document_ids")
    .map(String)
    .filter((v) => z.string().uuid().safeParse(v).success);
}

/** Premier document du prochain lot à vérifier (null s'il n'y en a plus). */
async function lotSuivant(supabase: Db["supabase"]) {
  const lots = await chargerLots(supabase);
  return lots[0]?.docs[0]?.id ?? null;
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
