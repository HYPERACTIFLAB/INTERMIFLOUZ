import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { chargerEntreprise } from "@/lib/data/micro";
import { EntrepriseForm } from "./entreprise-form";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  const db = await getDb();
  const header = <PageHeader title="Paramètres" description="Ton entreprise, telle qu'elle apparaît sur tes devis et factures" />;
  if (!db) return <>{header}<DemoNotice /></>;
  const entreprise = await chargerEntreprise(db.supabase);
  return (
    <>
      {header}
      <div className="card p-4 md:p-6">
        <EntrepriseForm e={entreprise} />
      </div>
    </>
  );
}
