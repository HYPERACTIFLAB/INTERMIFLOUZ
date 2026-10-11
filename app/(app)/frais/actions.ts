"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDb } from "@/lib/data/db";
import { parseEurosEnCentimes } from "@/lib/format";
import { CATEGORIES_FRAIS } from "@/lib/extraction/justificatif";
import { SUPPORTED_MIME, extractionEnabled } from "@/lib/extraction/config";

export type FormState = { error?: string };

const vide = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const dateIso = /^\d{4}-\d{2}-\d{2}$/;

const NoteSchema = z.object({
  date: z.string().regex(dateIso, "La date est obligatoire."),
  marchand: z.string().nullable(),
  description: z.string().nullable(),
  montant_ttc: z.number({ message: "Le montant est obligatoire." }).int().min(0),
  tva: z.number().int().min(0).nullable(),
  categorie: z.enum(CATEGORIES_FRAIS),
  moyen_paiement: z.string().nullable(),
  refacturable_a: z.enum(["employeur", "client", "aucun"]),
  organisation_id: z.string().uuid().nullable(),
  contrat_id: z.string().uuid().nullable(),
  statut: z.enum(["a_rembourser", "rembourse", "non_remboursable"]),
  date_remboursement: z.string().regex(dateIso).nullable(),
  notes: z.string().nullable(),
});

export async function saveNote(_: FormState, formData: FormData): Promise<FormState> {
  const statut = formData.get("statut");
  const parsed = NoteSchema.safeParse({
    date: formData.get("date"),
    marchand: vide(formData.get("marchand")),
    description: vide(formData.get("description")),
    montant_ttc: parseEurosEnCentimes(vide(formData.get("montant_ttc"))) ?? undefined,
    tva: parseEurosEnCentimes(vide(formData.get("tva"))),
    categorie: formData.get("categorie"),
    moyen_paiement: vide(formData.get("moyen_paiement")),
    refacturable_a: formData.get("refacturable_a"),
    organisation_id: vide(formData.get("organisation_id")),
    contrat_id: vide(formData.get("contrat_id")),
    statut,
    date_remboursement: statut === "rembourse" ? (vide(formData.get("date_remboursement")) ?? new Date().toISOString().slice(0, 10)) : null,
    notes: vide(formData.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase } = await requireDb();
  const projetNom = vide(formData.get("projet_nom"));
  let projet_id: string | null = null;
  if (projetNom) {
    const { data: p } = await supabase.from("projets").select("id").ilike("nom", projetNom).limit(1).maybeSingle();
    projet_id = (p?.id as string) ?? null;
    if (!projet_id) {
      const { data: cree } = await supabase.from("projets").insert({ nom: projetNom }).select("id").single();
      projet_id = (cree?.id as string) ?? null;
    }
  }
  const note = { ...parsed.data, projet_id };

  const id = vide(formData.get("id"));
  let noteId = id;
  if (id) {
    const { error } = await supabase.from("notes_de_frais").update(note).eq("id", id);
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
  } else {
    const { data, error } = await supabase.from("notes_de_frais").insert(note).select("id").single();
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
    noteId = data.id as string;
  }

  const documentId = vide(formData.get("document_id"));
  let suivant: string | null = null;
  if (documentId) {
    await supabase.from("documents").update({ note_frais_id: noteId, extraction_statut: "validee" }).eq("id", documentId);
    const { data } = await supabase
      .from("documents")
      .select("id")
      .eq("type", "justificatif")
      .is("note_frais_id", null)
      .neq("extraction_statut", "validee")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    suivant = (data?.id as string | undefined) ?? null;
  }

  revalidatePath("/frais");
  revalidatePath("/");
  redirect(suivant ? `/frais/importer/${suivant}?suite=1` : "/frais");
}

export async function marquerRembourse(formData: FormData) {
  const { supabase } = await requireDb();
  const id = z.string().uuid().parse(formData.get("id"));
  const rembourse = formData.get("rembourse") === "1";
  await supabase
    .from("notes_de_frais")
    .update({ statut: rembourse ? "rembourse" : "a_rembourser", date_remboursement: rembourse ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  revalidatePath("/frais");
  revalidatePath(`/frais/${id}`);
  revalidatePath("/");
}

export async function deleteNote(formData: FormData) {
  const { supabase } = await requireDb();
  const id = z.string().uuid().parse(formData.get("id"));
  const { data: docs } = await supabase.from("documents").select("id, chemin_stockage").eq("note_frais_id", id);
  if (docs?.length) {
    await supabase.storage.from("documents").remove(docs.map((d) => d.chemin_stockage as string));
    await supabase.from("documents").delete().in("id", docs.map((d) => d.id as string));
  }
  await supabase.from("notes_de_frais").delete().eq("id", id);
  revalidatePath("/frais");
  revalidatePath("/");
  redirect("/frais");
}

const JustificatifSchema = z.object({
  chemin: z.string().min(1),
  nomFichier: z.string().min(1).max(255),
  mime: z.enum(SUPPORTED_MIME),
  taille: z.number().int().min(0),
});

/** Enregistre un justificatif déjà déposé dans le stockage. */
export async function creerJustificatif(
  input: z.infer<typeof JustificatifSchema>,
): Promise<{ documentId?: string; lecture?: boolean; error?: string }> {
  const doc = JustificatifSchema.safeParse(input);
  if (!doc.success) return { error: "Fichier invalide." };
  const { supabase, user } = await requireDb();
  if (!doc.data.chemin.startsWith(`${user.id}/`)) return { error: "Chemin de fichier invalide." };
  const lecture = extractionEnabled();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      chemin_stockage: doc.data.chemin,
      nom_fichier: doc.data.nomFichier,
      mime: doc.data.mime,
      taille: doc.data.taille,
      type: "justificatif",
      extraction_statut: lecture ? "en_cours" : "aucune",
    })
    .select("id")
    .single();
  if (error) return { error: "Impossible d'enregistrer le justificatif : " + error.message };
  return { documentId: data.id as string, lecture };
}

/** Abandonne un justificatif pas encore transformé en note de frais. */
export async function abandonnerJustificatif(formData: FormData) {
  const { supabase } = await requireDb();
  const id = z.string().uuid().parse(formData.get("id"));
  const { data: doc } = await supabase
    .from("documents")
    .select("chemin_stockage")
    .eq("id", id)
    .is("note_frais_id", null)
    .maybeSingle();
  if (doc) {
    await supabase.storage.from("documents").remove([doc.chemin_stockage as string]);
    await supabase.from("documents").delete().eq("id", id);
  }
  revalidatePath("/frais");
  redirect("/frais");
}
