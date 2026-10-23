import Link from "next/link";
import { FilePlus2, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice, EmptyState } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { LIBELLES_STATUT_DEVIS, listDevis } from "@/lib/data/micro";
import { formatDate, formatEuros } from "@/lib/format";
import { Statut } from "../statut";

export const metadata = { title: "Devis" };

export default async function DevisPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Devis"
      actions={
        <Link href="/micro/devis/nouveau" className="btn-primary">
          <FilePlus2 size={18} aria-hidden /> Nouveau devis
        </Link>
      }
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;
  const devis = await listDevis(db.supabase);

  return (
    <>
      {header}
      {devis.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun devis">
          Un devis accepté se transforme en facture en un clic.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {devis.map((d) => (
            <li key={d.id}>
              <Link href={`/micro/devis/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.client?.nom ?? "Client à choisir"}</span>
                  <span className="block truncate text-sm text-muted">
                    {[d.numero, d.objet, d.date_emission && formatDate(d.date_emission)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-medium tabular-nums">{formatEuros(d.total)}</span>
                  <Statut statut={d.statut} libelle={LIBELLES_STATUT_DEVIS[d.statut]} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
