import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { ContratForm } from "../contrat-form";
import { VALEURS_VIDES } from "../form-values";

export const metadata = { title: "Nouveau contrat" };

export default async function NouveauContratPage() {
  const db = await getDb();
  const header = <PageHeader title="Nouveau contrat" back={{ href: "/contrats", label: "Contrats" }} />;
  if (!db) return <>{header}<DemoNotice /></>;

  const [organisations, projets] = await Promise.all([listOrganisations(db.supabase), listNomsProjets(db.supabase)]);
  return (
    <>
      {header}
      <div className="card p-4 md:p-6">
        <ContratForm valeurs={VALEURS_VIDES} organisations={organisations} projets={projets} submitLabel="Enregistrer le contrat" />
      </div>
    </>
  );
}
