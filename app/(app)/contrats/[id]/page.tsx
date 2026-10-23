import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  Clock,
  Euro,
  FileCheck2,
  FileSignature,
  FileText,
  Pencil,
  ReceiptText,
  Tag,
  Ticket,
  Trash2,
  Umbrella,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { lienTemporaire } from "@/lib/data/queries";
import { LIBELLES_AEM, LIBELLES_ANNEXE, LIBELLES_DOCUMENT, type Contrat, type DocumentRow } from "@/lib/data/types";
import { formatDate, formatEuros, formatNombre, formatPeriodeLongue } from "@/lib/format";
import { sousTitreContrat, titreContrat } from "@/lib/titre";
import { netAttendu, ratioNetBrut } from "@/lib/regles/revenus";
import { deleteDocument, marquerPaye, updateStatutAem } from "../actions";
import { Uploader } from "../uploader";

const ICONES_DOCUMENT: Record<string, LucideIcon> = {
  contrat: FileSignature,
  fiche_paie: ReceiptText,
  aem: FileCheck2,
  autre: Umbrella,
};

export default async function ContratPage({ params }: PageProps<"/contrats/[id]">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const [{ data: contrat }, { data: documents }, { data: salaires }] = await Promise.all([
    db.supabase
      .from("contrats")
      .select("*, organisation:organisations(id, nom), projet:projets(id, nom)")
      .eq("id", id)
      .maybeSingle<Contrat>(),
    db.supabase.from("documents").select("*").eq("contrat_id", id).order("created_at").returns<DocumentRow[]>(),
    db.supabase.from("contrats").select("salaire_brut, salaire_net"),
  ]);
  if (!contrat) notFound();

  const liens = await Promise.all((documents ?? []).map((d) => lienTemporaire(db.supabase, d.chemin_stockage)));

  // Sans fiche de paie, le net attendu est estimé à partir du brut (ton rapport net / brut habituel).
  const attendu = netAttendu(contrat, ratioNetBrut(salaires ?? []));
  const heures = Number(contrat.heures);
  const tauxHoraire = contrat.salaire_brut !== null && heures > 0 ? Math.round(contrat.salaire_brut / heures) : null;
  const lignes: { icone: LucideIcon; label: string; valeur: React.ReactNode }[] = [
    { icone: CalendarDays, label: "Dates", valeur: formatPeriodeLongue(contrat.date_debut, contrat.date_fin) },
    ...(contrat.jours_travailles.length ? [{ icone: CalendarCheck, label: "Jours travaillés", valeur: contrat.jours_travailles.length }] : []),
    {
      icone: Building2,
      label: "Employeur",
      valeur: contrat.organisation ? (
        <Link href={`/contacts/${contrat.organisation.id}`} className="text-accent">
          {contrat.organisation.nom}
        </Link>
      ) : null,
    },
    { icone: Briefcase, label: "Poste", valeur: contrat.poste },
    { icone: Clock, label: "Heures", valeur: heures ? `${formatNombre(heures)} h` : null },
    { icone: Ticket, label: "Cachets", valeur: contrat.cachets || null },
    { icone: Euro, label: "Brut", valeur: contrat.salaire_brut !== null ? formatEuros(contrat.salaire_brut) : null },
    { icone: Euro, label: "Taux horaire brut", valeur: tauxHoraire ? formatEuros(tauxHoraire) : null },
    { icone: Euro, label: "Net à payer", valeur: contrat.salaire_net !== null ? formatEuros(contrat.salaire_net) : null },
    { icone: Tag, label: "Annexe", valeur: LIBELLES_ANNEXE[contrat.annexe] },
  ].filter((l) => l.valeur !== null && l.valeur !== undefined && l.valeur !== "");

  return (
    <>
      <PageHeader
        title={titreContrat({ projet: contrat.projet?.nom, poste: contrat.poste, employeur: contrat.organisation?.nom })}
        description={sousTitreContrat({ projet: contrat.projet?.nom, poste: contrat.poste, employeur: contrat.organisation?.nom })}
        back={{ href: "/contrats", label: "Contrats" }}
        actions={
          <Link href={`/contrats/${contrat.id}/modifier`} className="btn-secondary">
            <Pencil size={16} aria-hidden /> Modifier
          </Link>
        }
      />

      <div className="space-y-8">
        <section aria-labelledby="details">
          <h2 id="details" className="mb-3 text-lg font-semibold">Détails</h2>
          <dl className="card divide-y divide-border">
            {lignes.map(({ icone: Icone, label, valeur }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Icone size={18} className="shrink-0 text-muted" aria-hidden />
                <dt className="text-muted">{label}</dt>
                <dd className="min-w-0 flex-1 text-right font-medium tabular-nums break-words">{valeur}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="suivi">
          <h2 id="suivi" className="mb-3 text-lg font-semibold">Suivi</h2>
          <div className="card divide-y divide-border">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <Wallet size={22} className="shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Salaire</p>
                <p className={`text-sm ${contrat.paye ? "text-accent" : "text-warning"}`}>
                  {contrat.paye
                    ? `Perçu${contrat.date_paiement ? ` (noté le ${formatDate(contrat.date_paiement)})` : ""}`
                    : `Pas encore perçu${
                        attendu.montant !== null ? ` · ${attendu.estime ? "environ " : ""}${formatEuros(attendu.montant)} net attendus` : ""
                      }`}
                </p>
              </div>
              <form action={marquerPaye}>
                <input type="hidden" name="id" value={contrat.id} />
                <input type="hidden" name="paye" value={contrat.paye ? "0" : "1"} />
                <SubmitButton className={contrat.paye ? "text-sm text-muted underline" : "btn-primary px-3 py-1.5 text-sm"} pendingLabel="…">
                  {contrat.paye ? "Annuler" : "Perçu"}
                </SubmitButton>
              </form>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <FileCheck2 size={22} className="shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Attestation employeur (AEM)</p>
                <p className={`text-sm ${contrat.statut_aem === "a_recevoir" ? "text-warning" : "text-accent"}`}>
                  {LIBELLES_AEM[contrat.statut_aem]}
                  {contrat.date_reception_aem && ` le ${formatDate(contrat.date_reception_aem)}`}
                </p>
              </div>
              <form action={updateStatutAem}>
                <input type="hidden" name="id" value={contrat.id} />
                {contrat.statut_aem === "a_recevoir" ? (
                  <button name="statut_aem" value="recue" className="btn-primary px-3 py-1.5 text-sm">Reçue</button>
                ) : contrat.statut_aem === "recue" ? (
                  <button name="statut_aem" value="transmise" className="btn-secondary px-3 py-1.5 text-sm">Transmise</button>
                ) : (
                  <button name="statut_aem" value="a_recevoir" className="text-sm text-muted underline">Annuler</button>
                )}
              </form>
            </div>
          </div>
        </section>

        <section aria-labelledby="documents">
          <h2 id="documents" className="mb-3 text-lg font-semibold">Documents</h2>
          <div className="card divide-y divide-border">
            {(documents ?? []).map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 p-4">
                {(() => {
                  const Icone = ICONES_DOCUMENT[d.type] ?? FileText;
                  return <Icone size={22} className="shrink-0 text-muted" aria-hidden />;
                })()}
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
              <summary className="cursor-pointer font-medium text-accent">+ Ajouter un document (bulletin, AEM…)</summary>
              <div className="mt-4">
                <Uploader userId={db.user.id} mode="ajout" contratId={contrat.id} />
              </div>
            </details>
          </div>
        </section>

      </div>
    </>
  );
}
