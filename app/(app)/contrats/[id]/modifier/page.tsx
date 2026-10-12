import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/ui";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { listNomsProjets, listOrganisations } from "@/lib/data/queries";
import type { Contrat } from "@/lib/data/types";
import { titreContrat } from "@/lib/titre";
import { deleteContrat } from "../../actions";
import { ContratForm } from "../../contrat-form";
import { valeursDepuisContrat } from "../../form-values";

export const metadata = { title: "Modifier le contrat" };

export default async function ModifierContratPage({ params }: PageProps<"/contrats/[id]/modifier">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const [{ data: contrat }, organisations, projets] = await Promise.all([
    db.supabase
      .from("contrats")
      .select("*, organisation:organisations(id, nom), projet:projets(id, nom)")
      .eq("id", id)
      .maybeSingle<Contrat>(),
    listOrganisations(db.supabase),
    listNomsProjets(db.supabase),
  ]);
  if (!contrat) notFound();
  const titre = titreContrat({ projet: contrat.projet?.nom, poste: contrat.poste, employeur: contrat.organisation?.nom });

  return (
    <>
      <PageHeader title="Modifier" description={titre} back={{ href: `/contrats/${contrat.id}`, label: titre }} />
      <div className="space-y-8">
        <div className="card p-4 md:p-6">
          <ContratForm
            valeurs={valeursDepuisContrat(contrat)}
            organisations={organisations}
            projets={projets}
            contratId={contrat.id}
            source={contrat.source}
            joursTravailles={contrat.jours_travailles}
            submitLabel="Enregistrer"
          />
        </div>
        <form action={deleteContrat} className="text-center">
          <input type="hidden" name="id" value={contrat.id} />
          <ConfirmButton className="text-sm text-danger underline" message="Supprimer ce contrat et ses documents ? C'est définitif.">
            Supprimer ce contrat
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
