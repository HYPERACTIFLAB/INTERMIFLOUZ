import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { ajouterJours, aujourdhui } from "@/lib/regles/dates";
import { DocumentForm } from "../../document-form";

export const metadata = { title: "Nouveau devis" };

export default async function NouveauDevisPage() {
  const db = await getDb();
  const header = <PageHeader title="Nouveau devis" back={{ href: "/micro/devis", label: "Devis" }} />;
  if (!db) return <>{header}<DemoNotice /></>;
  const [clients, projets] = await Promise.all([listOrganisations(db.supabase), listNomsProjets(db.supabase)]);
  const jour = aujourdhui();
  return (
    <>
      {header}
      <div className="card p-4 md:p-6">
        <DocumentForm
          type="devis"
          clients={clients}
          projets={projets}
          valeurs={{ organisation_id: "", projet_nom: "", objet: "", date_emission: jour, date_limite: ajouterJours(jour, 30), lignes: [], notes: "" }}
        />
      </div>
    </>
  );
}
