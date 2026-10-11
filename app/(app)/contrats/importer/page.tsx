import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { extractionEnabled } from "@/lib/extraction/config";
import { Uploader } from "../uploader";

export const metadata = { title: "Importer un contrat" };
// La lecture par Claude peut prendre jusqu'à une minute.
export const maxDuration = 120;

export default async function ImporterPage() {
  const db = await getDb();
  const lecture = extractionEnabled();
  return (
    <>
      <PageHeader
        title="Importer un document"
        description={
          lecture
            ? "Contrat, fiche de paie ou AEM, en PDF ou en photo. Claude lit le document et pré-remplit la fiche ; tu vérifies avant d'enregistrer."
            : "Contrat, fiche de paie ou AEM, en PDF ou en photo. Le document sera rattaché à la fiche que tu rempliras."
        }
        back={{ href: "/contrats", label: "Contrats" }}
      />
      {!db ? (
        <DemoNotice />
      ) : (
        <>
          {!lecture && (
            <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
              La lecture automatique est désactivée (pas de clé Claude configurée) : tu rempliras la fiche à la main.
            </p>
          )}
          <div className="card p-4 md:p-6">
            <Uploader userId={db.user.id} mode="import" />
          </div>
        </>
      )}
    </>
  );
}
