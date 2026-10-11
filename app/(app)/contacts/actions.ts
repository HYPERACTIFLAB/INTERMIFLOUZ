"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDb } from "@/lib/data/db";

export type FormState = { error?: string; ok?: boolean };

const texte = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const OrganisationSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  type: z.enum(["employeur", "client", "les_deux"]),
  siret: texte.refine((v) => v === null || /^\d{14}$/.test(v.replace(/\s/g, "")), "Le SIRET doit comporter 14 chiffres."),
  numero_objet: texte,
  adresse: texte,
  email: texte,
  telephone: texte,
  notes: texte,
});

function lire(formData: FormData, champs: string[]) {
  return Object.fromEntries(champs.map((c) => [c, formData.get(c) ?? ""]));
}

export async function saveOrganisation(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = OrganisationSchema.safeParse(lire(formData, Object.keys(OrganisationSchema.shape)));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = { ...parsed.data, siret: parsed.data.siret?.replace(/\s/g, "") ?? null };

  const { supabase } = await requireDb();
  const id = formData.get("id") as string | null;

  if (id) {
    const { error } = await supabase.from("organisations").update(data).eq("id", id);
    if (error) return { error: "Impossible d'enregistrer : " + error.message };
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    return { ok: true };
  }

  const { data: created, error } = await supabase.from("organisations").insert(data).select("id").single();
  if (error) return { error: "Impossible d'enregistrer : " + error.message };
  revalidatePath("/contacts");
  redirect(`/contacts/${created.id}`);
}

export async function deleteOrganisation(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  await supabase.from("organisations").delete().eq("id", id);
  revalidatePath("/contacts");
  redirect("/contacts");
}

const ContactSchema = z
  .object({
    organisation_id: texte,
    prenom: texte,
    nom: texte,
    fonction: texte,
    email: texte,
    telephone: texte,
    notes: texte,
  })
  .refine((c) => c.prenom || c.nom, "Indique au moins un prénom ou un nom.");

export async function saveContact(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = ContactSchema.safeParse(
    lire(formData, ["organisation_id", "prenom", "nom", "fonction", "email", "telephone", "notes"]),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase } = await requireDb();
  const id = formData.get("id") as string | null;
  const { error } = id
    ? await supabase.from("contacts").update(parsed.data).eq("id", id)
    : await supabase.from("contacts").insert(parsed.data);
  if (error) return { error: "Impossible d'enregistrer : " + error.message };

  revalidatePath("/contacts");
  if (parsed.data.organisation_id) revalidatePath(`/contacts/${parsed.data.organisation_id}`);
  return { ok: true };
}

export async function deleteContact(formData: FormData) {
  const { supabase } = await requireDb();
  const id = String(formData.get("id"));
  const organisationId = formData.get("organisation_id") as string | null;
  await supabase.from("contacts").delete().eq("id", id);
  if (organisationId) revalidatePath(`/contacts/${organisationId}`);
  revalidatePath("/contacts");
}
