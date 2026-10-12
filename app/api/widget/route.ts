import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { aujourdhui } from "@/lib/regles/dates";
import { resumeWidget, type DonneesWidget } from "@/lib/widget/resume";

/** Chiffres clés pour le widget iPhone. Identification par la clé perso (pas de session). */
export async function GET(request: NextRequest) {
  const cle = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const sansCache = { "Cache-Control": "no-store" };
  if (!cle) return NextResponse.json({ erreur: "Clé manquante" }, { status: 401, headers: sansCache });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("donnees_widget", { p_cle: cle });
  if (error) {
    console.error("Widget", error);
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500, headers: sansCache });
  }
  if (!data) return NextResponse.json({ erreur: "Clé invalide : recrée le script dans l'appli" }, { status: 401, headers: sansCache });

  return NextResponse.json(resumeWidget(data as DonneesWidget, aujourdhui()), { headers: sansCache });
}
