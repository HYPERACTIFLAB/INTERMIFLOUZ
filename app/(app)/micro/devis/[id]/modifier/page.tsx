import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { chargerDevis } from "@/lib/data/micro";
import { listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { valeursDepuisDocument } from "../../../apercu";
import { DocumentForm } from "../../../document-form";

export const metadata = { title: "Modifier le devis" };

export default async function ModifierDevisPage({ params }: PageProps<"/micro/devis/[id]/modifier">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;
  const [d, clients, projets] = await Promise.all([chargerDevis(db.supabase, id), listOrganisations(db.supabase), listNomsProjets(db.supabase)]);
  if (!d) notFound();
  return (
    <>
      <PageHeader title={`Modifier le devis ${d.numero}`} back={{ href: `/micro/devis/${id}`, label: "Devis" }} />
      <div className="card p-4 md:p-6">
        <DocumentForm type="devis" clients={clients} projets={projets} valeurs={valeursDepuisDocument(d, d.date_validite)} />
      </div>
    </>
  );
}
