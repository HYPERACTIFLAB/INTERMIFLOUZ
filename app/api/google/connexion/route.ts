import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/data/db";
import { GOOGLE_SCOPE, googleConfigured, googleIdentifiants, URL_AUTORISATION } from "@/lib/google/config";

/** Envoie vers Google pour autoriser l'appli à créer son agenda. */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const db = await getDb();
  if (!db || !googleConfigured()) return NextResponse.redirect(`${origin}/agenda?erreur=config`);

  const etat = randomBytes(24).toString("base64url");
  const url = new URL(URL_AUTORISATION);
  url.search = new URLSearchParams({
    client_id: googleIdentifiants().id,
    redirect_uri: `${origin}/api/google/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: etat,
    ...(db.user.email ? { login_hint: db.user.email } : {}),
  }).toString();

  const reponse = NextResponse.redirect(url);
  // Protège contre une fausse réponse : Google doit renvoyer ce même code « state ».
  reponse.cookies.set("google_etat", etat, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return reponse;
}
