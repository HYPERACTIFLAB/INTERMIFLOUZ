"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDb } from "@/lib/data/db";
import { revoquer } from "@/lib/google/api";
import { dechiffrer } from "@/lib/google/chiffrement";
import { synchroniserTout } from "@/lib/google/synchro";

export async function toutSynchroniser() {
  const { supabase } = await requireDb();
  const r = await synchroniserTout(supabase);
  revalidatePath("/agenda");
  redirect(r.error ? "/agenda?erreur=synchro" : `/agenda?envoye=${r.nombre}`);
}

export async function deconnecterGoogle() {
  const { supabase, user } = await requireDb();
  const { data } = await supabase.from("connexions_google").select("refresh_token_chiffre").maybeSingle();
  if (data) {
    try {
      await revoquer(dechiffrer(data.refresh_token_chiffre as string));
    } catch {
      // Jeton illisible : on supprime quand même la connexion.
    }
  }
  await supabase.from("evenements_agenda").delete().eq("user_id", user.id);
  await supabase.from("connexions_google").delete().eq("user_id", user.id);
  revalidatePath("/agenda");
  redirect("/agenda?deconnecte=1");
}
