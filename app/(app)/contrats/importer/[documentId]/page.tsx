import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ExternalLink, FileCheck2, FileSignature, FileText, Link2, Loader2, ReceiptText, Sparkles, type LucideIcon } from "lucide-react";
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
import { titreContrat } from "@/lib/titre";
import { abandonnerImport, rattacherAuContrat } from "../../actions";
import { ContratForm } from "../../contrat-form";
import { VALEURS_VIDES, valeursDepuisExtraction } from "../../form-values";
import { RelancerLecture } from "./relancer";

export const metadata = { title: "Vérifier l'import" };

const ICONES: Record<string, LucideIcon> = { contrat: FileSignature, fiche_paie: ReceiptText, aem: FileCheck2 };

export default async function VerifierImportPage({ params, searchParams }: PageProps<"/contrats/importer/[documentId]">) {
  const { documentId } = await params;
  const { suite } = await searchParams;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const lots = await chargerLots(db.supabase);
  const position = lots.findIndex((l) => l.docs.some((d) => d.id === documentId));
  const lot = lots[position];
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
  // Une AEM fait partie du lot : elle est donc reçue.
  if (lot.docs.some((d) => d.type === "aem")) {
    form = { ...form, valeurs: { ...form.valeurs, statut_aem: "recue", date_reception_aem: new Date().toISOString().slice(0, 10) } };
  }

  const titre = e ? titreContrat({ projet: e.projet.valeur, poste: e.poste.valeur, employeur: e.employeur_nom.valeur }) : lot.docs[0].nom_fichier;
  const sousTitre = e
    ? [e.projet.valeur ? e.employeur_nom.valeur : null, e.date_debut.valeur ? formatPeriode(e.date_debut.valeur, e.date_fin.valeur ?? e.date_debut.valeur) : null]
        .filter(Boolean)
        .join(" · ")
    : "Document à vérifier";

  return (
    <>
      <PageHeader
        title={titre}
        description={
          <>
            {sousTitre}
            {lots.length > 1 && <span className="mt-1 block text-xs">Import {position + 1} sur {lots.length} à vérifier</span>}
          </>
        }
        back={{ href: "/contrats", label: "Contrats" }}
      />

      <div className="space-y-5">
        {suite === "1" && (
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">Enregistré ✓ Voici le suivant.</p>
        )}

        {/* Documents du lot */}
        <ul className="flex flex-wrap gap-2" aria-label="Documents">
          {lot.docs.map((d, i) => {
            const Icone = ICONES[d.type] ?? FileText;
            const contenu = (
              <>
                <Icone size={16} aria-hidden />
                {LIBELLES_DOCUMENT[d.type as DocumentType] ?? "Document"}
                {liens[i] && <ExternalLink size={12} className="text-muted" aria-hidden />}
              </>
            );
            return (
              <li key={d.id}>
                {liens[i] ? (
                  <a href={liens[i]!} target="_blank" rel="noopener noreferrer" title={d.nom_fichier} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-accent">
                    {contenu}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm">{contenu}</span>
                )}
              </li>
            );
          })}
        </ul>

        {lot.statut === "en_cours" && (
          <div className="card flex items-center gap-3 p-4 text-sm" aria-live="polite">
            <Loader2 size={20} className="shrink-0 animate-spin text-accent" aria-hidden />
            <span>Claude lit le document… La fiche se remplira toute seule dans quelques secondes.</span>
            <AutoRefresh />
          </div>
        )}

        {lot.statut === "erreur" && (
          <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <p>{lot.docs[0].extraction_erreur ?? "La lecture automatique a échoué."} Tu peux remplir la fiche à la main.</p>
            {extractionEnabled() && <RelancerLecture documentId={lot.docs[0].id} />}
          </div>
        )}

        {existant && (
          <section className="card border-accent/50 p-4 md:p-5">
            <p className="flex items-center gap-2 font-medium">
              <Link2 size={18} className="text-accent" aria-hidden /> Déjà dans tes contrats ?
            </p>
            <p className="mt-1 text-sm text-muted">
              {lot.docs.length > 1 ? "Ces documents correspondent" : "Ce document correspond"} sans doute à{" "}
              <Link href={`/contrats/${existant.id}`} className="font-medium text-foreground underline">
                {existant.poste ?? "un contrat"} chez {existant.organisation?.nom} ({formatPeriode(existant.date_debut, existant.date_fin)})
              </Link>
              .
            </p>
            <form action={rattacherAuContrat} className="mt-3">
              <input type="hidden" name="contrat_id" value={existant.id} />
              {lot.docs.map((d) => (
                <input key={d.id} type="hidden" name="document_ids" value={d.id} />
              ))}
              <SubmitButton pendingLabel="Ajout…" className="btn-primary w-full sm:w-auto">Ajouter au contrat existant</SubmitButton>
            </form>
            <p className="mt-2 text-xs text-muted">Les montants manquants seront complétés. Sinon, valide plus bas pour créer un nouveau contrat.</p>
          </section>
        )}

        {e && (form.incertains.length > 0 || e.remarques) && (
          <div className={`flex gap-3 rounded-xl px-4 py-3 text-sm ${form.incertains.length ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"}`}>
            {form.incertains.length ? <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden /> : <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden />}
            <div>
              {form.incertains.length > 0 && <p className="font-medium">{form.incertains.length} information(s) à vérifier, en orange.</p>}
              {e.remarques && <p className={form.incertains.length ? "mt-1" : ""}>{e.remarques}</p>}
            </div>
          </div>
        )}

        <section className="card p-4 md:p-6" aria-label="Fiche du contrat">
          {e && (
            <p className="mb-3 flex items-center gap-1.5 text-sm text-muted">
              <Sparkles size={14} aria-hidden /> Lu par Claude{lot.docs.length > 1 ? ` dans ${lot.docs.length} documents` : ""}
            </p>
          )}
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
            apercu={!!e}
            submitLabel={existant ? "Créer un nouveau contrat" : "Valider le contrat"}
          />
        </section>

        <form action={abandonnerImport} className="text-center">
          {lot.docs.map((d) => (
            <input key={d.id} type="hidden" name="document_ids" value={d.id} />
          ))}
          <ConfirmButton
            className="text-sm text-muted underline hover:text-danger"
            message={lot.docs.length > 1 ? `Supprimer ces ${lot.docs.length} documents sans les enregistrer ?` : "Supprimer ce document sans l'enregistrer ?"}
          >
            Ne pas enregistrer : supprimer {lot.docs.length > 1 ? "ces documents" : "ce document"}
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
