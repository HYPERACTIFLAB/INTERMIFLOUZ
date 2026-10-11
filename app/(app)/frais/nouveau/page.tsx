import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { listContratsChoix } from "@/lib/data/frais";
import { listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { NOTE_VIDE, NoteForm } from "../note-form";

export const metadata = { title: "Nouvelle note de frais" };

export default async function NouvelleNotePage() {
  const db = await getDb();
  const header = <PageHeader title="Nouvelle note de frais" back={{ href: "/frais", label: "Notes de frais" }} />;
  if (!db) return <>{header}<DemoNotice /></>;
  const [organisations, contrats, projets] = await Promise.all([
    listOrganisations(db.supabase),
    listContratsChoix(db.supabase),
    listNomsProjets(db.supabase),
  ]);
  return (
    <>
      {header}
      <div className="card p-4 md:p-6">
        <NoteForm
          valeurs={{ ...NOTE_VIDE, date: new Date().toISOString().slice(0, 10) }}
          organisations={organisations}
          contrats={contrats}
          projets={projets}
          submitLabel="Enregistrer"
        />
      </div>
    </>
  );
}
