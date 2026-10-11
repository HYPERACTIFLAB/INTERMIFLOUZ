import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Link2 } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { chargerLots, contratCorrespondant } from "@/lib/data/imports";
import { lienTemporaire, listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { LIBELLES_DOCUMENT, type DocumentType } from "@/lib/data/types";
import { extractionEnabled } from "@/lib/extraction/config";
import { formatPeriode } from "@/lib/format";
import { memeEmployeur } from "@/lib/extraction/regroupement";
import { abandonnerImport, rattacherAuContrat } from "../../actions";
import { ContratForm } from "../../contrat-form";
import { DocumentPreview } from "../../document-preview";
import { VALEURS_VIDES, valeursDepuisExtraction } from "../../form-values";
import { RelancerLecture } from "./relancer";

export const metadata = { title: "Vérifier l'import" };

export default async function VerifierImportPage({ params, searchParams }: PageProps<"/contrats/importer/[documentId]">) {
  const { documentId } = await params;
  const { suite } = await searchParams;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const lots = await chargerLots(db.supabase);
  const lot = lots.find((l) => l.docs.some((d) => d.id === documentId));
  if (!lot) {
    // Déjà validé (rattaché à un contrat) ou supprimé.
    const { data: doc } = await db.supabase.from("documents").select("contrat_id").eq("id", documentId).maybeSingle();
    if (doc?.contrat_id) redirect(`/contrats/${doc.contrat_id}`);
    notFound();
  }

  const [organisations, projets, liens, existant] = await Promise.all([
    listOrganisations(db.supabase),
    listNomsProjets(db.supabase),
    Promise.all(lot.docs.map((d) => lienTemporaire(db.supabase, d.chemin_stockage))),
    lot.extraction ? contratCorrespondant(db.supabase, lot.extraction) : Promise.resolve(null),
  ]);

  let form = { valeurs: VALEURS_VIDES, incertains: [] as string[], sources: {} as Record<string, string>, jours: [] as string[] };
  const e = lot.extraction;
  if (e) {
    const employeur = { siret: e.employeur_siret.valeur, nom: e.employeur_nom.valeur };
    const trouvee = organisations.find((o) => memeEmployeur({ siret: o.siret, nom: o.nom }, employeur)) ?? null;
    form = valeursDepuisExtraction(e, trouvee);
  }

  const premier = lot.docs[0];
  const restants = lots.length - 1;
  const titre =
    lot.docs.length > 1 ? `${lot.docs.length} documents pour un même contrat` : premier.nom_fichier;

  return (
    <>
      <PageHeader title="Vérifier et valider" description={titre} back={{ href: "/contrats", label: "Contrats" }} />

      {suite === "1" && (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Enregistré. Voici la suite{restants > 0 ? ` (encore ${restants} après celui-ci)` : ""}.
        </p>
      )}

      {lot.statut === "en_cours" && (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent" aria-live="polite">
          Claude lit encore le document… La fiche se remplira toute seule dans quelques secondes.
          <AutoRefresh />
        </p>
      )}

      {lot.statut === "erreur" && (
        <div className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <p>
            {premier.extraction_erreur ?? "La lecture automatique a échoué."} Tu peux remplir la fiche à la main ; le
            document y sera rattaché.
          </p>
          {extractionEnabled() && <RelancerLecture documentId={premier.id} />}
        </div>
      )}

      {existant && (
        <section className="mb-4 rounded-xl border border-accent/40 bg-accent-soft p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-accent">
            <Link2 size={18} aria-hidden /> Contrat déjà enregistré
          </p>
          <p className="mt-1">
            {lot.docs.length > 1 ? "Ces documents correspondent" : "Ce document correspond"} sans doute au contrat{" "}
            <Link href={`/contrats/${existant.id}`} className="underline">
              {existant.poste ?? "sans intitulé"} chez {existant.organisation?.nom} ({formatPeriode(existant.date_debut, existant.date_fin)})
            </Link>
            .
          </p>
          <form action={rattacherAuContrat} className="mt-3">
            <input type="hidden" name="contrat_id" value={existant.id} />
            {lot.docs.map((d) => (
              <input key={d.id} type="hidden" name="document_ids" value={d.id} />
            ))}
            <SubmitButton pendingLabel="Rattachement…">Rattacher à ce contrat</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-muted">Les montants manquants du contrat seront complétés. Sinon, crée une nouvelle fiche ci-dessous.</p>
        </section>
      )}

      {e && (
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
              {lot.docs.length > 1 ? "Claude a regroupé ces documents sur une seule fiche. " : "Claude a pré-rempli la fiche. "}
              {form.incertains.length
                ? `${form.incertains.length} champ(s) à vérifier, en orange.`
                : "Vérifie quand même avant d'enregistrer."}
            </p>
            {e.remarques && <p className="mt-1">{e.remarques}</p>}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {lot.docs.map((d, i) => (
          <details key={d.id} className="card p-4" open={lot.docs.length === 1}>
            <summary className="cursor-pointer font-medium">
              {LIBELLES_DOCUMENT[d.type as DocumentType] ?? "Document"} · <span className="font-normal text-muted">{d.nom_fichier}</span>
            </summary>
            <div className="mt-3">
              <DocumentPreview url={liens[i]} mime={d.mime} nom={d.nom_fichier} />
            </div>
          </details>
        ))}

        <div className="card p-4 md:p-6">
          <ContratForm
            key={lot.statut + lot.docs.map((d) => d.id).join()}
            valeurs={form.valeurs}
            organisations={organisations}
            projets={projets}
            documents={lot.docs}
            source={e ? "import_ia" : "manuel"}
            joursTravailles={form.jours}
            incertains={form.incertains}
            sources={form.sources}
            submitLabel="Valider et enregistrer"
          />
        </div>

        <form action={abandonnerImport}>
          {lot.docs.map((d) => (
            <input key={d.id} type="hidden" name="document_ids" value={d.id} />
          ))}
          <ConfirmButton
            message={lot.docs.length > 1 ? `Abandonner ces ${lot.docs.length} documents ? Les fichiers seront supprimés.` : "Abandonner cet import ? Le fichier sera supprimé."}
          >
            Abandonner l&apos;import
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
