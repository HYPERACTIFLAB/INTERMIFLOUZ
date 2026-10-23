import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { chargerFacture } from "@/lib/data/micro";
import { listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { valeursDepuisDocument } from "../../../apercu";
import { DocumentForm } from "../../../document-form";

export const metadata = { title: "Modifier la facture" };

export default async function ModifierFacturePage({ params }: PageProps<"/micro/factures/[id]/modifier">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;
  const [f, clients, projets] = await Promise.all([chargerFacture(db.supabase, id), listOrganisations(db.supabase), listNomsProjets(db.supabase)]);
  if (!f) notFound();
  if (f.statut !== "brouillon") redirect(`/micro/factures/${id}`);
  return (
    <>
      <PageHeader title="Modifier la facture" back={{ href: `/micro/factures/${id}`, label: "Facture" }} />
      <div className="card p-4 md:p-6">
        <DocumentForm type="facture" clients={clients} projets={projets} valeurs={valeursDepuisDocument(f, f.date_echeance)} />
      </div>
    </>
  );
}
