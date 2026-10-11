"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDb } from "@/lib/data/db";
import { REGLES_PAR_DEFAUT } from "@/lib/regles/regles";

export type FormState = { error?: string; ok?: boolean };

const dateOuVide = z
  .string()
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide.");

export async function saveSituation(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      droits_ouverts: z.boolean(),
      date_ouverture: dateOuVide,
      date_anniversaire: dateOuVide,
      aj_actuelle: z
        .string()
        .transform((v) => (v.trim() === "" ? null : Number(v.replace(",", "."))))
        .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Montant invalide."),
    })
    .safeParse({
      droits_ouverts: formData.get("droits_ouverts") === "oui",
      date_ouverture: String(formData.get("date_ouverture") ?? ""),
      date_anniversaire: String(formData.get("date_anniversaire") ?? ""),
      aj_actuelle: String(formData.get("aj_actuelle") ?? ""),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.droits_ouverts && !parsed.data.date_anniversaire) {
    return { error: "Indique ta date anniversaire (elle figure sur ta notification de droits France Travail)." };
  }

  const { supabase, user } = await requireDb();
  const { error } = await supabase
    .from("situation_intermittence")
    .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: "Impossible d'enregistrer : " + error.message };
  revalidatePath("/intermittence");
  return { ok: true };
}

export async function saveRegle(formData: FormData) {
  const cle = String(formData.get("cle"));
  if (!(cle in REGLES_PAR_DEFAUT)) return;
  const valeur = Number(String(formData.get("valeur")).replace(",", "."));
  if (!Number.isFinite(valeur)) return;
  const { supabase, user } = await requireDb();
  await supabase.from("regles_override").upsert({
    user_id: user.id,
    cle,
    valeur,
    verifie_le: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/regles");
  revalidatePath("/intermittence");
}

export async function resetRegle(formData: FormData) {
  const { supabase } = await requireDb();
  await supabase.from("regles_override").delete().eq("cle", String(formData.get("cle")));
  revalidatePath("/regles");
  revalidatePath("/intermittence");
}
