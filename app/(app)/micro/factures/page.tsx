import Link from "next/link";
import { FilePlus2, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice, EmptyState } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { LIBELLES_STATUT_FACTURE, listFactures, resteDu } from "@/lib/data/micro";
import { aujourdhui } from "@/lib/regles/dates";
import { enRetard } from "@/lib/micro/calcul";
import { formatDate, formatEuros } from "@/lib/format";
import { Statut } from "../statut";

export const metadata = { title: "Factures" };

export default async function FacturesPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Factures"
      actions={
        <Link href="/micro/factures/nouvelle" className="btn-primary">
          <FilePlus2 size={18} aria-hidden /> Nouvelle facture
        </Link>
      }
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;
  const factures = await listFactures(db.supabase);
  const jour = aujourdhui();

  return (
    <>
      {header}
      {factures.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune facture">
          Crée ta première facture, ou transforme un devis accepté en facture.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {factures.map((f) => {
            const statut = enRetard(f, jour) ? "en_retard" : f.statut;
            return (
              <li key={f.id}>
                <Link href={`/micro/factures/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.client?.nom ?? "Client à choisir"}</span>
                    <span className="block truncate text-sm text-muted">
                      {[f.numero ?? "Brouillon", f.objet, f.date_emission && formatDate(f.date_emission)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums">{formatEuros(f.total)}</span>
                    <Statut statut={statut} libelle={statut === "emise" && resteDu(f) < f.total ? "Payée en partie" : LIBELLES_STATUT_FACTURE[statut]} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
