import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/data/db";
import { extractionEnabled } from "@/lib/extraction/config";
import { lancerExtraction } from "@/lib/extraction/run";

// La lecture continue après la réponse ; Vercel (offre Hobby) laisse jusqu'à 5 minutes.
export const maxDuration = 300;

/**
 * Lance la lecture d'un document par Claude et répond tout de suite (202).
 * Le résultat est écrit dans la table documents ; l'appli le surveille.
 */
export async function POST(request: NextRequest) {
  if (!extractionEnabled()) return NextResponse.json({ erreur: "Lecture désactivée" }, { status: 503 });
  const db = await getDb();
  if (!db) return NextResponse.json({ erreur: "Non connecté" }, { status: 401 });

  const corps = await request.json().catch(() => ({}));
  const documentId = z.string().uuid().safeParse(corps?.documentId);
  if (!documentId.success) return NextResponse.json({ erreur: "Document invalide" }, { status: 400 });

  // Client Supabase au nom de l'utilisateur connecté : les règles RLS s'appliquent.
  after(() => lancerExtraction(db.supabase, documentId.data));
  return NextResponse.json({ ok: true }, { status: 202 });
}
