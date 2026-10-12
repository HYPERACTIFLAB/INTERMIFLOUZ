import Link from "next/link";
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
        title="Ajouter des documents"
        description={lecture ? "Claude les lit et remplit les fiches. Tu n'as plus qu'à vérifier." : undefined}
        back={{ href: "/contrats", label: "Contrats" }}
      />
      {!db ? (
        <DemoNotice />
      ) : (
        <div className="space-y-4">
          {!lecture && (
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
              La lecture automatique est désactivée (pas de clé Claude configurée) : tu rempliras la fiche à la main.
            </p>
          )}
          <Uploader userId={db.user.id} mode="import" />
          <p className="text-center text-sm text-muted">
            Pas de document ?{" "}
            <Link href="/contrats/nouveau" className="font-medium text-accent">
              Saisir un contrat à la main
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
