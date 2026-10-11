import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/data/db";
import { echangerCode, ErreurGoogle } from "@/lib/google/api";
import { chiffrer } from "@/lib/google/chiffrement";
import { GOOGLE_SCOPE, googleConfigured } from "@/lib/google/config";
import { synchroniserTout } from "@/lib/google/synchro";

/** Retour de Google : on garde le jeton (chiffré), on crée l'agenda et on y envoie les contrats. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const vers = (params: string) => {
    const r = NextResponse.redirect(`${origin}/agenda?${params}`);
    r.cookies.delete({ name: "google_etat", path: "/api/google" });
    return r;
  };

  const db = await getDb();
  if (!db || !googleConfigured()) return vers("erreur=config");
  if (searchParams.get("error")) return vers("erreur=refus");

  const etat = request.cookies.get("google_etat")?.value;
  const code = searchParams.get("code");
  if (!code || !etat || etat !== searchParams.get("state")) return vers("erreur=etat");

  try {
    const jetons = await echangerCode(code, `${origin}/api/google/callback`);
    if (!jetons.scope?.split(" ").includes(GOOGLE_SCOPE)) return vers("erreur=permission");
    if (!jetons.refresh_token) return vers("erreur=jeton");

    const { data: avant } = await db.supabase.from("connexions_google").select("agenda_id").maybeSingle();
    const { error } = await db.supabase.from("connexions_google").upsert({
      user_id: db.user.id,
      refresh_token_chiffre: chiffrer(jetons.refresh_token),
      agenda_id: avant?.agenda_id ?? null,
      app_url: origin,
      derniere_erreur: null,
      connecte_le: new Date().toISOString(),
    });
    if (error) throw error;

    const r = await synchroniserTout(db.supabase);
    return vers(r.error ? "erreur=synchro" : `connecte=${r.nombre}`);
  } catch (e) {
    console.error("Connexion Google", e);
    return vers(e instanceof ErreurGoogle ? "erreur=google" : "erreur=inconnue");
  }
}
