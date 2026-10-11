import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/config";

/** Retour de Google après la connexion : on échange le code contre une session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) return NextResponse.redirect(`${origin}/connexion?erreur=echec`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) return NextResponse.redirect(`${origin}/connexion?erreur=echec`);

  if (!isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/connexion?erreur=non-autorise`);
  }

  return NextResponse.redirect(`${origin}/`);
}
