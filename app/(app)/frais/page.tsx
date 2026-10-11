import Link from "next/link";
import { PenLine, Receipt } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { DemoNotice, EmptyState } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { listNotes } from "@/lib/data/frais";
import { LIBELLES_CATEGORIE } from "@/lib/extraction/justificatif";
import { formatDate, formatEuros } from "@/lib/format";
import { Scanner } from "./scanner";

export const metadata = { title: "Notes de frais" };

const STATUT = {
  a_rembourser: { libelle: "À rembourser", cls: "bg-warning-soft text-warning" },
  rembourse: { libelle: "Remboursé", cls: "bg-accent-soft text-accent" },
  non_remboursable: { libelle: "Non remboursable", cls: "bg-background text-muted" },
};

export default async function FraisPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Notes de frais"
      description="Tickets et factures à te faire rembourser"
      actions={
        <Link href="/frais/nouveau" className="btn-secondary">
          <PenLine size={18} aria-hidden /> Saisir
        </Link>
      }
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;

  const [notes, { data: aVerifier }] = await Promise.all([
    listNotes(db.supabase),
    db.supabase
      .from("documents")
      .select("id, nom_fichier, extraction_statut, extraction_brute")
      .eq("type", "justificatif")
      .is("note_frais_id", null)
      .neq("extraction_statut", "validee")
      .order("created_at"),
  ]);
  const aRembourser = notes.filter((n) => n.statut === "a_rembourser");
  const totalARembourser = aRembourser.reduce((s, n) => s + n.montant_ttc, 0);

  return (
    <>
      {header}
      <div className="space-y-6">
        <div className="card p-4">
          <p className="mb-3 text-sm text-muted">Photographie un ticket ou choisis des fichiers : Claude lit le montant, la date et le commerçant.</p>
          <Scanner userId={db.user.id} />
        </div>

        {(aVerifier ?? []).length > 0 && (
          <section className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
            <p className="font-medium text-warning">Justificatifs à vérifier ({aVerifier!.length})</p>
            <ul className="mt-2 divide-y divide-warning/20 text-sm">
              {aVerifier!.map((d) => {
                const e = d.extraction_brute as { marchand?: string | null; montant_ttc?: number | null } | null;
                return (
                  <li key={d.id}>
                    <Link href={`/frais/importer/${d.id}`} className="flex justify-between gap-3 py-2">
                      <span className="truncate underline">{e?.marchand ?? d.nom_fichier}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {d.extraction_statut === "en_cours"
                          ? "lecture en cours…"
                          : e?.montant_ttc != null
                            ? formatEuros(Math.round(e.montant_ttc * 100))
                            : d.extraction_statut === "erreur"
                              ? "lecture échouée"
                              : "à remplir"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {aVerifier!.some((d) => d.extraction_statut === "en_cours") && <AutoRefresh intervalMs={4000} />}
          </section>
        )}

        <div className="card flex items-center justify-between p-4">
          <span className="text-sm text-muted">À te faire rembourser</span>
          <span className="text-2xl font-semibold tabular-nums">{formatEuros(totalARembourser)}</span>
        </div>

        {notes.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucune note de frais">
            Photographie ton premier ticket ci-dessus.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-border overflow-hidden">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={`/frais/${n.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-background">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{n.marchand ?? n.description ?? LIBELLES_CATEGORIE[n.categorie]}</p>
                    <p className="truncate text-sm text-muted">
                      {formatDate(n.date)} · {LIBELLES_CATEGORIE[n.categorie]}
                      {n.organisation?.nom ? ` · ${n.organisation.nom}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums">{formatEuros(n.montant_ttc)}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${STATUT[n.statut].cls}`}>{STATUT[n.statut].libelle}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
