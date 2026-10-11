import { notFound, redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/ui";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { listContratsChoix } from "@/lib/data/frais";
import { lienTemporaire, listNomsProjets, listOrganisations } from "@/lib/data/queries";
import type { DocumentRow } from "@/lib/data/types";
import { extractionEnabled } from "@/lib/extraction/config";
import { JustificatifExtractionSchema } from "@/lib/extraction/justificatif";
import { centimesVersSaisie } from "@/lib/format";
import { DocumentPreview } from "../../../contrats/document-preview";
import { RelancerLecture } from "../../../contrats/importer/[documentId]/relancer";
import { abandonnerJustificatif } from "../../actions";
import { NOTE_VIDE, NoteForm, type NoteValeurs } from "../../note-form";

export const metadata = { title: "Vérifier le justificatif" };

export default async function VerifierJustificatifPage({ params, searchParams }: PageProps<"/frais/importer/[documentId]">) {
  const { documentId } = await params;
  const { suite } = await searchParams;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const { data: doc } = await db.supabase.from("documents").select("*").eq("id", documentId).maybeSingle<DocumentRow & { note_frais_id: string | null }>();
  if (!doc || doc.type !== "justificatif") notFound();
  if (doc.note_frais_id) redirect(`/frais/${doc.note_frais_id}`);

  const [organisations, contrats, projets, url] = await Promise.all([
    listOrganisations(db.supabase),
    listContratsChoix(db.supabase),
    listNomsProjets(db.supabase),
    lienTemporaire(db.supabase, doc.chemin_stockage),
  ]);

  const parsed = JustificatifExtractionSchema.safeParse(doc.extraction_brute);
  const e = parsed.success ? parsed.data : null;
  let valeurs: NoteValeurs = { ...NOTE_VIDE };
  if (e) {
    // Un contrat couvre la date du ticket : on le propose.
    const contrat = e.date ? contrats.find((c) => c.date_debut <= e.date! && e.date! <= c.date_fin) : undefined;
    valeurs = {
      ...valeurs,
      date: e.date ?? "",
      marchand: e.marchand ?? "",
      description: e.description ?? "",
      montant_ttc: e.montant_ttc === null ? "" : centimesVersSaisie(Math.round(e.montant_ttc * 100)),
      tva: e.tva === null ? "" : centimesVersSaisie(Math.round(e.tva * 100)),
      categorie: e.categorie,
      moyen_paiement: e.moyen_paiement ?? "",
      contrat_id: contrat?.id ?? "",
      organisation_id: contrat?.organisation_id ?? "",
    };
  }

  return (
    <>
      <PageHeader title="Vérifier le justificatif" description={doc.nom_fichier} back={{ href: "/frais", label: "Notes de frais" }} />

      {suite === "1" && (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">Note enregistrée. Voici le justificatif suivant.</p>
      )}
      {doc.extraction_statut === "en_cours" && (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent" aria-live="polite">
          Claude lit encore le justificatif… <AutoRefresh />
        </p>
      )}
      {doc.extraction_statut === "erreur" && (
        <div className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <p>{doc.extraction_erreur ?? "La lecture automatique a échoué."} Tu peux remplir la note à la main.</p>
          {extractionEnabled() && <RelancerLecture documentId={doc.id} />}
        </div>
      )}
      {e && (
        <div className={`mb-4 flex gap-3 rounded-xl px-4 py-3 text-sm ${e.incertains.length ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"}`}>
          {e.incertains.length ? <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />}
          <div>
            <p className="font-medium">
              Claude a pré-rempli la note.{" "}
              {e.incertains.length ? `${e.incertains.length} champ(s) à vérifier, en orange.` : "Vérifie avant d'enregistrer."}
            </p>
            {e.remarques && <p className="mt-1">{e.remarques}</p>}
            {valeurs.contrat_id && <p className="mt-1">Rattachée au contrat en cours à cette date.</p>}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <details className="card p-4" open>
          <summary className="cursor-pointer font-medium">Justificatif</summary>
          <div className="mt-3">
            <DocumentPreview url={url} mime={doc.mime} nom={doc.nom_fichier} />
          </div>
        </details>
        <div className="card p-4 md:p-6">
          <NoteForm
            key={doc.extraction_statut}
            valeurs={valeurs}
            organisations={organisations}
            contrats={contrats}
            projets={projets}
            documentId={doc.id}
            incertains={e?.incertains ?? []}
            submitLabel="Valider la note"
          />
        </div>
        <form action={abandonnerJustificatif}>
          <input type="hidden" name="id" value={doc.id} />
          <ConfirmButton message="Abandonner ce justificatif ? Le fichier sera supprimé.">Abandonner</ConfirmButton>
        </form>
      </div>
    </>
  );
}
