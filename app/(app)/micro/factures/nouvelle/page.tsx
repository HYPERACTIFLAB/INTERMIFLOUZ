import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { DocumentForm } from "../../document-form";

export const metadata = { title: "Nouvelle facture" };

export default async function NouvelleFacturePage() {
  const db = await getDb();
  const header = <PageHeader title="Nouvelle facture" back={{ href: "/micro/factures", label: "Factures" }} />;
  if (!db) return <>{header}<DemoNotice /></>;
  const [clients, projets] = await Promise.all([listOrganisations(db.supabase), listNomsProjets(db.supabase)]);
  return (
    <>
      {header}
      <p className="mb-4 text-sm text-muted">Elle reste en brouillon (modifiable) jusqu&apos;à ce que tu l&apos;émettes : elle reçoit alors son numéro.</p>
      <div className="card p-4 md:p-6">
        <DocumentForm
          type="facture"
          clients={clients}
          projets={projets}
          valeurs={{ organisation_id: "", projet_nom: "", objet: "", date_emission: new Date().toISOString().slice(0, 10), date_limite: "", lignes: [], notes: "" }}
        />
      </div>
    </>
  );
}
