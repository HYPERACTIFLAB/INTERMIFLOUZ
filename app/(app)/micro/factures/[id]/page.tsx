import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Download, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { getDb } from "@/lib/data/db";
import { chargerEntreprise, chargerFacture, infosManquantes, LIBELLES_STATUT_FACTURE, resteDu } from "@/lib/data/micro";
import { aujourdhui } from "@/lib/regles/dates";
import { enRetard } from "@/lib/micro/calcul";
import { centimesVersSaisie, formatDate, formatEuros } from "@/lib/format";
import { annulerFacture, emettreFacture, enregistrerPaiement, supprimerFacture, supprimerPaiement } from "../../actions";
import { Apercu } from "../../apercu";
import { Statut } from "../../statut";

export const metadata = { title: "Facture" };

const MOYENS = ["virement", "chèque", "espèces", "carte", "autre"];

export default async function FacturePage({ params }: PageProps<"/micro/factures/[id]">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;
  const [f, entreprise] = await Promise.all([chargerFacture(db.supabase, id), chargerEntreprise(db.supabase)]);
  if (!f) notFound();

  const jour = aujourdhui();
  const statut = enRetard(f, jour) ? "en_retard" : f.statut;
  const reste = resteDu(f);
  const manquent = infosManquantes(entreprise);

  return (
    <>
      <PageHeader
        title={f.numero ? `Facture ${f.numero}` : "Facture (brouillon)"}
        description={[f.client?.nom, formatEuros(f.total)].filter(Boolean).join(" · ")}
        back={{ href: "/micro/factures", label: "Factures" }}
        actions={
          <>
            {f.statut === "brouillon" && (
              <Link href={`/micro/factures/${f.id}/modifier`} className="btn-secondary">
                <Pencil size={16} aria-hidden /> Modifier
              </Link>
            )}
            <a href={`/api/pdf/facture/${f.id}`} className="btn-secondary">
              <Download size={16} aria-hidden /> PDF
            </a>
          </>
        }
      />

      <div className="space-y-6">
        {manquent.length > 0 && (
          <Link href="/parametres" className="flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>Il manque {manquent.join(", ")} pour une facture conforme. Complète tes Paramètres.</span>
          </Link>
        )}

        <section className="card space-y-3 p-4 md:p-5" aria-label="Suivi">
          <div className="flex flex-wrap items-center gap-2">
            <Statut statut={statut} libelle={LIBELLES_STATUT_FACTURE[statut]} />
            {f.date_echeance && f.statut === "emise" && <span className="text-sm text-muted">échéance le {formatDate(f.date_echeance)}</span>}
          </div>

          {f.statut === "brouillon" && (
            <div className="flex flex-wrap items-center gap-3">
              <form action={emettreFacture}>
                <input type="hidden" name="id" value={f.id} />
                <ConfirmButton className="btn-primary" message="Émettre la facture ? Elle reçoit son numéro et ne pourra plus être modifiée.">
                  Émettre la facture
                </ConfirmButton>
              </form>
              <form action={supprimerFacture}>
                <input type="hidden" name="id" value={f.id} />
                <ConfirmButton className="inline-flex items-center gap-1 text-sm text-danger" message="Supprimer ce brouillon ?">
                  <Trash2 size={14} aria-hidden /> Supprimer le brouillon
                </ConfirmButton>
              </form>
            </div>
          )}

          {f.statut === "emise" && (
            <form action={enregistrerPaiement} className="grid gap-3 rounded-xl bg-background p-3 sm:grid-cols-4 sm:items-end">
              <input type="hidden" name="facture_id" value={f.id} />
              <p className="text-sm font-medium sm:col-span-4">Paiement reçu · reste dû {formatEuros(reste)}</p>
              <label className="text-xs text-muted">
                Date
                <input name="date" type="date" defaultValue={jour} className="input mt-1" />
              </label>
              <label className="text-xs text-muted">
                Montant (€)
                <input name="montant" inputMode="decimal" defaultValue={centimesVersSaisie(reste)} className="input mt-1" />
              </label>
              <label className="text-xs text-muted">
                Moyen
                <select name="moyen" className="input mt-1">
                  {MOYENS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <SubmitButton pendingLabel="…">Enregistrer</SubmitButton>
            </form>
          )}

          {f.paiements.length > 0 && (
            <ul className="divide-y divide-border text-sm">
              {f.paiements.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">
                    Reçu le {formatDate(p.date)}
                    {p.moyen ? ` · ${p.moyen}` : ""}
                  </span>
                  <span className="font-medium tabular-nums">{formatEuros(p.montant)}</span>
                  <form action={supprimerPaiement}>
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton className="p-1 text-muted hover:text-danger" message="Supprimer ce paiement ?">
                      <Trash2 size={14} aria-label="Supprimer le paiement" />
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {f.statut === "emise" && (
            <form action={annulerFacture}>
              <input type="hidden" name="id" value={f.id} />
              <ConfirmButton
                className="text-xs text-muted underline"
                message="Annuler cette facture ? Son numéro reste utilisé (une facture émise ne se supprime pas)."
              >
                Annuler la facture
              </ConfirmButton>
            </form>
          )}
        </section>

        <Apercu
          type="facture"
          numero={f.numero}
          entreprise={entreprise}
          client={f.client}
          objet={f.objet}
          dateEmission={f.date_emission}
          dateLimite={f.date_echeance}
          lignes={f.lignes}
          total={f.total}
          notes={f.notes}
        />
      </div>
    </>
  );
}
