import Link from "next/link";
import { FilePlus2, FileText, PenLine, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice, EmptyState } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { usageIaDuMois } from "@/lib/data/queries";
import { LIBELLES_AEM, type Contrat } from "@/lib/data/types";
import { formatEuros, formatNombre, formatPeriode } from "@/lib/format";

export const metadata = { title: "Contrats" };

const COULEUR_AEM = {
  a_recevoir: "bg-warning-soft text-warning",
  recue: "bg-accent-soft text-accent",
  transmise: "bg-background text-muted",
};

export default async function ContratsPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Contrats"
      description="Tes contrats d'intermittence"
      actions={
        <>
          <Link href="/contrats/importer" className="btn-primary">
            <FilePlus2 size={18} aria-hidden /> Importer un PDF
          </Link>
          <Link href="/contrats/nouveau" className="btn-secondary">
            <PenLine size={18} aria-hidden /> Saisir
          </Link>
        </>
      }
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;

  const [{ data }, { data: aValider }, usage] = await Promise.all([
    db.supabase
      .from("contrats")
      .select("*, organisation:organisations(id, nom), projet:projets(id, nom)")
      .order("date_debut", { ascending: false })
      .returns<Contrat[]>(),
    db.supabase
      .from("documents")
      .select("id, nom_fichier")
      .is("contrat_id", null)
      .in("extraction_statut", ["a_valider", "erreur", "aucune"])
      .in("type", ["contrat", "fiche_paie", "aem"])
      .order("created_at", { ascending: false }),
    usageIaDuMois(db.supabase),
  ]);
  const contrats = data ?? [];

  const parAnnee = new Map<string, Contrat[]>();
  for (const c of contrats) {
    const annee = c.date_debut.slice(0, 4);
    parAnnee.set(annee, [...(parAnnee.get(annee) ?? []), c]);
  }

  return (
    <>
      {header}

      {(aValider ?? []).length > 0 && (
        <section className="mb-6 rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <p className="font-medium text-warning">Imports à terminer</p>
          <ul className="mt-2 space-y-1 text-sm">
            {aValider!.map((d) => (
              <li key={d.id}>
                <Link href={`/contrats/importer/${d.id}`} className="underline">
                  {d.nom_fichier}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {contrats.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun contrat pour l'instant">
          Importe le PDF d&apos;un contrat ou d&apos;une fiche de paie : les informations seront
          pré-remplies, tu n&apos;auras plus qu&apos;à vérifier.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {[...parAnnee.entries()].map(([annee, liste]) => (
            <section key={annee} aria-labelledby={`annee-${annee}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id={`annee-${annee}`} className="text-lg font-semibold">{annee}</h2>
                <p className="text-sm text-muted">
                  {formatNombre(liste.reduce((s, c) => s + Number(c.heures), 0))} h ·{" "}
                  {liste.reduce((s, c) => s + c.cachets, 0)} cachet(s) ·{" "}
                  {formatEuros(liste.reduce((s, c) => s + (c.salaire_brut ?? 0), 0))} brut
                </p>
              </div>
              <ul className="card divide-y divide-border overflow-hidden">
                {liste.map((c) => (
                  <li key={c.id}>
                    <Link href={`/contrats/${c.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-background">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.organisation?.nom ?? "Employeur non renseigné"}</p>
                        <p className="truncate text-sm text-muted">
                          {[c.poste, c.projet?.nom].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">{formatPeriode(c.date_debut, c.date_fin)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {c.cachets > 0 && Number(c.heures) === 0 ? `${c.cachets} cachet(s)` : `${formatNombre(Number(c.heures))} h`}
                        </p>
                        <p className="text-sm tabular-nums text-muted">{formatEuros(c.salaire_brut)}</p>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${COULEUR_AEM[c.statut_aem]}`}>
                          {LIBELLES_AEM[c.statut_aem]}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {usage.lectures > 0 && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted">
          <Sparkles size={14} aria-hidden />
          Ce mois-ci : {usage.lectures} lecture(s) par Claude, environ{" "}
          {usage.coutUsd.toLocaleString("fr-FR", { style: "currency", currency: "USD" })}.
        </p>
      )}
    </>
  );
}
