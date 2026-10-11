import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/ui";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { lienTemporaire, listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { LIBELLES_AEM, LIBELLES_ANNEXE, LIBELLES_DOCUMENT, type Contrat, type DocumentRow } from "@/lib/data/types";
import { formatDate, formatEuros, formatNombre } from "@/lib/format";
import { deleteContrat, deleteDocument, updateStatutAem } from "../actions";
import { ContratForm } from "../contrat-form";
import { valeursDepuisContrat } from "../form-values";
import { Uploader } from "../uploader";

export default async function ContratPage({ params }: PageProps<"/contrats/[id]">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const [{ data: contrat }, { data: documents }, organisations, projets] = await Promise.all([
    db.supabase
      .from("contrats")
      .select("*, organisation:organisations(id, nom), projet:projets(id, nom)")
      .eq("id", id)
      .maybeSingle<Contrat>(),
    db.supabase.from("documents").select("*").eq("contrat_id", id).order("created_at").returns<DocumentRow[]>(),
    listOrganisations(db.supabase),
    listNomsProjets(db.supabase),
  ]);
  if (!contrat) notFound();

  const liens = await Promise.all((documents ?? []).map((d) => lienTemporaire(db.supabase, d.chemin_stockage)));

  const lignes: [string, React.ReactNode][] = [
    ["Employeur", contrat.organisation ? <Link href={`/contacts/${contrat.organisation.id}`} className="text-accent">{contrat.organisation.nom}</Link> : "—"],
    ["Projet", contrat.projet?.nom ?? "—"],
    ["Du", formatDate(contrat.date_debut)],
    ["Au", formatDate(contrat.date_fin)],
    ["Heures", `${formatNombre(Number(contrat.heures))} h`],
    ["Cachets", String(contrat.cachets)],
    ["Salaire brut", formatEuros(contrat.salaire_brut)],
    ["Salaire net", formatEuros(contrat.salaire_net)],
    ["Annexe", LIBELLES_ANNEXE[contrat.annexe]],
  ];
  if (contrat.jours_travailles.length) lignes.push(["Jours travaillés", String(contrat.jours_travailles.length)]);

  return (
    <>
      <PageHeader
        title={contrat.poste ?? "Contrat"}
        description={contrat.organisation?.nom}
        back={{ href: "/contrats", label: "Contrats" }}
      />

      <div className="space-y-8">
        <dl className="card grid grid-cols-2 gap-x-4 gap-y-3 p-4 md:grid-cols-4 md:p-6">
          {lignes.map(([label, valeur]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-0.5 break-words font-medium tabular-nums">{valeur}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="aem" className="card p-4 md:p-6">
          <h2 id="aem" className="font-semibold">Attestation employeur (AEM)</h2>
          <p className="mt-1 text-sm text-muted">
            {LIBELLES_AEM[contrat.statut_aem]}
            {contrat.date_reception_aem && ` · reçue le ${formatDate(contrat.date_reception_aem)}`}
          </p>
          <form action={updateStatutAem} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={contrat.id} />
            {(["a_recevoir", "recue", "transmise"] as const)
              .filter((s) => s !== contrat.statut_aem)
              .map((s) => (
                <button key={s} name="statut_aem" value={s} className="btn-secondary text-sm">
                  Marquer « {LIBELLES_AEM[s].replace("AEM ", "")} »
                </button>
              ))}
          </form>
        </section>

        <section aria-labelledby="documents">
          <h2 id="documents" className="mb-3 text-lg font-semibold">Documents</h2>
          <div className="card divide-y divide-border">
            {(documents ?? []).map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 p-4">
                <FileText size={20} className="shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  {liens[i] ? (
                    <a href={liens[i]!} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-accent">
                      {d.nom_fichier}
                    </a>
                  ) : (
                    <p className="truncate font-medium">{d.nom_fichier}</p>
                  )}
                  <p className="text-sm text-muted">
                    {LIBELLES_DOCUMENT[d.type]} · ajouté le {formatDate(d.created_at)}
                  </p>
                </div>
                <form action={deleteDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <ConfirmButton message={`Supprimer ${d.nom_fichier} ?`} className="p-2 text-muted hover:text-danger">
                    <Trash2 size={16} aria-label={`Supprimer ${d.nom_fichier}`} />
                  </ConfirmButton>
                </form>
              </div>
            ))}
            <details className="p-4">
              <summary className="cursor-pointer font-medium text-accent">Ajouter un document (fiche de paie, AEM…)</summary>
              <div className="mt-4">
                <Uploader userId={db.user.id} mode="ajout" contratId={contrat.id} />
              </div>
            </details>
          </div>
        </section>

        <details className="card p-4 md:p-6">
          <summary className="cursor-pointer font-semibold">Modifier le contrat</summary>
          <div className="mt-4">
            <ContratForm
              valeurs={valeursDepuisContrat(contrat)}
              organisations={organisations}
              projets={projets}
              contratId={contrat.id}
              source={contrat.source}
              joursTravailles={contrat.jours_travailles}
              submitLabel="Enregistrer les modifications"
            />
          </div>
        </details>

        <form action={deleteContrat}>
          <input type="hidden" name="id" value={contrat.id} />
          <ConfirmButton message="Supprimer ce contrat et ses documents ? C'est définitif.">Supprimer le contrat</ConfirmButton>
        </form>
      </div>
    </>
  );
}
