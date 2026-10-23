import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { getDb } from "@/lib/data/db";
import { chargerDevis, chargerEntreprise, LIBELLES_STATUT_DEVIS } from "@/lib/data/micro";
import { formatEuros } from "@/lib/format";
import { devisEnFacture, statutDevis, supprimerDevis } from "../../actions";
import { Apercu } from "../../apercu";
import { Statut } from "../../statut";

export const metadata = { title: "Devis" };

export default async function DevisDetailPage({ params }: PageProps<"/micro/devis/[id]">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;
  const [d, entreprise, { data: factures }] = await Promise.all([
    chargerDevis(db.supabase, id),
    chargerEntreprise(db.supabase),
    db.supabase.from("factures").select("id, numero").eq("devis_id", id),
  ]);
  if (!d) notFound();

  return (
    <>
      <PageHeader
        title={`Devis ${d.numero}`}
        description={[d.client?.nom, formatEuros(d.total)].filter(Boolean).join(" · ")}
        back={{ href: "/micro/devis", label: "Devis" }}
        actions={
          <>
            <Link href={`/micro/devis/${d.id}/modifier`} className="btn-secondary">
              <Pencil size={16} aria-hidden /> Modifier
            </Link>
            <a href={`/api/pdf/devis/${d.id}`} className="btn-secondary">
              <Download size={16} aria-hidden /> PDF
            </a>
          </>
        }
      />

      <div className="space-y-6">
        <section className="card space-y-3 p-4 md:p-5" aria-label="Suivi">
          <div className="flex flex-wrap items-center gap-2">
            <Statut statut={d.statut} libelle={LIBELLES_STATUT_DEVIS[d.statut]} />
            {factures?.map((f) => (
              <Link key={f.id} href={`/micro/factures/${f.id}`} className="text-sm text-accent underline">
                Facture {f.numero ?? "(brouillon)"}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={devisEnFacture}>
              <input type="hidden" name="id" value={d.id} />
              <SubmitButton pendingLabel="Création…" className={factures?.length ? "btn-secondary" : "btn-primary"}>
                <ReceiptText size={16} aria-hidden /> Transformer en facture
              </SubmitButton>
            </form>
            <form action={statutDevis} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={d.id} />
              {(["envoye", "accepte", "refuse"] as const)
                .filter((s) => s !== d.statut)
                .map((s) => (
                  <button key={s} name="statut" value={s} className="btn-secondary text-sm">
                    {LIBELLES_STATUT_DEVIS[s]}
                  </button>
                ))}
            </form>
          </div>
          <form action={supprimerDevis}>
            <input type="hidden" name="id" value={d.id} />
            <ConfirmButton className="text-xs text-muted underline" message="Supprimer ce devis ?">
              Supprimer le devis
            </ConfirmButton>
          </form>
        </section>

        <Apercu
          type="devis"
          numero={d.numero}
          entreprise={entreprise}
          client={d.client}
          objet={d.objet}
          dateEmission={d.date_emission}
          dateLimite={d.date_validite}
          lignes={d.lignes}
          total={d.total}
          notes={d.notes}
        />
      </div>
    </>
  );
}
