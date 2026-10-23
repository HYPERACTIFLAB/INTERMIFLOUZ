import Link from "next/link";
import { Plus, Trash2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice, EmptyState } from "@/components/states";
import { ConfirmButton } from "@/components/ui";
import { getDb } from "@/lib/data/db";
import { listPaiements, type Paiement } from "@/lib/data/micro";
import { formatDate, formatEuros } from "@/lib/format";
import { supprimerPaiement } from "../actions";

export const metadata = { title: "Encaissements" };

const nomMois = (m: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(m + "-01T00:00:00Z"));

export default async function EncaissementsPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Encaissements"
      description="Ton chiffre d'affaires micro : ce que tu as réellement reçu, mois par mois."
      actions={
        <Link href="/micro/encaissements/nouveau" className="btn-secondary">
          <Plus size={18} aria-hidden /> Recette sans facture
        </Link>
      }
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;
  const paiements = await listPaiements(db.supabase);
  const parMois = new Map<string, Paiement[]>();
  for (const p of paiements) parMois.set(p.date.slice(0, 7), [...(parMois.get(p.date.slice(0, 7)) ?? []), p]);

  return (
    <>
      {header}
      {paiements.length === 0 ? (
        <EmptyState icon={Wallet} title="Aucun encaissement">
          Quand un client te paie, note-le sur sa facture (« Paiement reçu »). Pour une vente sans facture, utilise « Recette sans
          facture ».
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...parMois.entries()].map(([mois, liste]) => (
            <section key={mois}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-semibold first-letter:uppercase">{nomMois(mois)}</h2>
                <p className="text-sm font-medium tabular-nums">{formatEuros(liste.reduce((s, p) => s + p.montant, 0))}</p>
              </div>
              <ul className="card divide-y divide-border overflow-hidden">
                {liste.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      {p.facture ? (
                        <Link href={`/micro/factures/${p.facture.id}`} className="block truncate font-medium text-accent">
                          {p.facture.client?.nom ?? "Facture"} · {p.facture.numero}
                        </Link>
                      ) : (
                        <span className="block truncate font-medium">{p.libelle}</span>
                      )}
                      <span className="block text-sm text-muted">
                        {formatDate(p.date)}
                        {p.moyen ? ` · ${p.moyen}` : ""}
                        {!p.facture && " · sans facture"}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatEuros(p.montant)}</span>
                    {!p.facture && (
                      <form action={supprimerPaiement}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton className="p-1 text-muted hover:text-danger" message="Supprimer cette recette ?">
                          <Trash2 size={14} aria-label="Supprimer" />
                        </ConfirmButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
