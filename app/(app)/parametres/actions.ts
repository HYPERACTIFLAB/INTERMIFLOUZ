"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDb } from "@/lib/data/db";

export type EtatParametres = { error?: string; ok?: boolean };

const texte = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const EntrepriseSchema = z.object({
  nom: texte,
  nom_commercial: texte,
  activite: texte,
  siret: texte.refine((v) => v === null || /^\d{14}$/.test(v.replace(/\s/g, "")), "Le SIRET doit comporter 14 chiffres."),
  adresse: texte,
  email: texte,
  telephone: texte,
  iban: texte.refine((v) => v === null || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v.replace(/\s/g, "").toUpperCase()), "IBAN invalide."),
  bic: texte,
  date_debut_activite: texte.refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide."),
  mention_tva: z.string().trim().min(1, "La mention de TVA est obligatoire sur les factures."),
  conditions_paiement: z.string().trim().min(1, "Indique les conditions de paiement."),
  penalites_retard: z.string().trim().min(1, "Les pénalités de retard sont une mention obligatoire."),
});

export async function saveEntreprise(_: EtatParametres, formData: FormData): Promise<EtatParametres> {
  const parsed = EntrepriseSchema.safeParse(Object.fromEntries(Object.keys(EntrepriseSchema.shape).map((c) => [c, formData.get(c) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const { supabase, user } = await requireDb();
  const { error } = await supabase.from("parametres_entreprise").upsert({
    user_id: user.id,
    ...d,
    siret: d.siret?.replace(/\s/g, "") ?? null,
    iban: d.iban?.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim() ?? null,
    bic: d.bic?.toUpperCase() ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Impossible d'enregistrer : " + error.message };
  revalidatePath("/parametres");
  revalidatePath("/micro");
  return { ok: true };
}
