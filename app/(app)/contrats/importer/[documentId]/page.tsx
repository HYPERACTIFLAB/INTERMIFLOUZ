import { notFound, redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/ui";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { lienTemporaire, listNomsProjets, listOrganisations } from "@/lib/data/queries";
import type { DocumentRow } from "@/lib/data/types";
import { ContratExtractionSchema } from "@/lib/extraction/contrat-schema";
import { abandonnerImport } from "../../actions";
import { ContratForm } from "../../contrat-form";
import { DocumentPreview } from "../../document-preview";
import { RelancerLecture } from "./relancer";
import { extractionEnabled } from "@/lib/extraction/config";
import { VALEURS_VIDES, valeursDepuisExtraction } from "../../form-values";

export const metadata = { title: "Vérifier l'import" };

export default async function VerifierImportPage({ params, searchParams }: PageProps<"/contrats/importer/[documentId]">) {
  const { documentId } = await params;
  const { suite } = await searchParams;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const { data: doc } = await db.supabase.from("documents").select("*").eq("id", documentId).maybeSingle<DocumentRow>();
  if (!doc) notFound();
  if (doc.contrat_id) redirect(`/contrats/${doc.contrat_id}`);

  const [organisations, projets, url] = await Promise.all([
    listOrganisations(db.supabase),
    listNomsProjets(db.supabase),
    lienTemporaire(db.supabase, doc.chemin_stockage),
  ]);

  const extraction = ContratExtractionSchema.safeParse(doc.extraction_brute);
  let form = { valeurs: VALEURS_VIDES, incertains: [] as string[], sources: {} as Record<string, string>, jours: [] as string[] };
  let remarques: string | null = null;

  if (extraction.success) {
    const e = extraction.data;
    const siret = e.employeur_siret.valeur?.replace(/\s/g, "");
    const nom = e.employeur_nom.valeur?.trim().toLowerCase();
    const trouvee =
      organisations.find((o) => siret && o.siret === siret) ??
      organisations.find((o) => nom && o.nom.trim().toLowerCase() === nom) ??
      null;
    form = valeursDepuisExtraction(e, trouvee);
    remarques = e.remarques;
  }

  return (
    <>
      <PageHeader
        title="Vérifier et valider"
        description={doc.nom_fichier}
        back={{ href: "/contrats", label: "Contrats" }}
      />

      {suite === "1" && (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Contrat précédent enregistré. Voici le document suivant à vérifier.
        </p>
      )}

      {doc.extraction_statut === "en_cours" && (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent" aria-live="polite">
          Claude lit encore le document… La fiche se remplira toute seule dans quelques secondes.
          <AutoRefresh />
        </p>
      )}

      {doc.extraction_statut === "erreur" && (
        <div className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <p>
            {doc.extraction_erreur ?? "La lecture automatique a échoué."} Tu peux remplir la fiche à la main ; le document y sera rattaché.
          </p>
          {extractionEnabled() && <RelancerLecture documentId={doc.id} />}
        </div>
      )}

      {extraction.success && (
        <div
          className={`mb-4 flex gap-3 rounded-xl px-4 py-3 text-sm ${
            form.incertains.length ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"
          }`}
        >
          {form.incertains.length ? (
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          )}
          <div>
            <p className="font-medium">
              {form.incertains.length
                ? `Claude a pré-rempli la fiche. ${form.incertains.length} champ(s) à vérifier, en orange.`
                : "Claude a pré-rempli la fiche. Vérifie quand même avant d'enregistrer."}
            </p>
            {remarques && <p className="mt-1">{remarques}</p>}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <details className="card p-4" open>
          <summary className="cursor-pointer font-medium">Document</summary>
          <div className="mt-3">
            <DocumentPreview url={url} mime={doc.mime} nom={doc.nom_fichier} />
          </div>
        </details>

        <div className="card p-4 md:p-6">
          <ContratForm
            key={doc.extraction_statut}
            valeurs={form.valeurs}
            organisations={organisations}
            projets={projets}
            documentId={doc.id}
            source={extraction.success ? "import_ia" : "manuel"}
            joursTravailles={form.jours}
            incertains={form.incertains}
            sources={form.sources}
            submitLabel="Valider et enregistrer"
          />
        </div>

        <form action={abandonnerImport}>
          <input type="hidden" name="id" value={doc.id} />
          <ConfirmButton message="Abandonner cet import ? Le fichier sera supprimé.">Abandonner l&apos;import</ConfirmButton>
        </form>
      </div>
    </>
  );
}
