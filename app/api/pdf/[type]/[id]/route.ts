import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/data/db";
import { chargerDevis, chargerEntreprise, chargerFacture } from "@/lib/data/micro";
import { genererPdf } from "@/lib/micro/pdf";

/** PDF d'un devis ou d'une facture (lecture au nom de l'utilisateur connecté : RLS). */
export async function GET(_: NextRequest, { params }: RouteContext<"/api/pdf/[type]/[id]">) {
  const { type, id } = await params;
  if (type !== "devis" && type !== "facture") return new NextResponse("Introuvable", { status: 404 });
  const db = await getDb();
  if (!db) return new NextResponse("Non connecté", { status: 401 });

  const [entreprise, doc] = await Promise.all([
    chargerEntreprise(db.supabase),
    type === "devis" ? chargerDevis(db.supabase, id) : chargerFacture(db.supabase, id),
  ]);
  if (!doc) return new NextResponse("Introuvable", { status: 404 });

  const octets = await genererPdf({
    type,
    numero: doc.numero,
    entreprise,
    client: doc.client,
    objet: doc.objet,
    dateEmission: doc.date_emission,
    dateLimite: "date_validite" in doc ? doc.date_validite : doc.date_echeance,
    lignes: doc.lignes,
    total: doc.total,
    notes: doc.notes,
  });
  const nom = `${type === "devis" ? "Devis" : "Facture"} ${doc.numero ?? "brouillon"}${doc.client ? ` - ${doc.client.nom}` : ""}.pdf`;
  return new NextResponse(Buffer.from(octets), {
    headers: {
      "Content-Type": "application/pdf",
      // « inline » : l'iPhone l'ouvre directement (puis Partager → Enregistrer / envoyer).
      "Content-Disposition": `inline; filename="${nom.replace(/[^\w .-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
