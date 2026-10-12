import Link from "next/link";
import { ChevronRight, FilePlus2, FileText, Loader2, Sparkles } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { titreContrat } from "@/lib/titre";
import { PageHeader } from "@/components/page-header";
import { DemoNotice, EmptyState } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { usageIaDuMois } from "@/lib/data/queries";
import { chargerLots } from "@/lib/data/imports";
import type { Contrat } from "@/lib/data/types";
import { aujourdhui } from "@/lib/regles/dates";
import { formatEuros, formatNombre, formatPeriode } from "@/lib/format";

export const metadata = { title: "Contrats" };

const STATUT_IMPORT = {
  en_cours: "Lecture…",
  a_valider: "À vérifier",
  erreur: "Lecture échouée",
  aucune: "À remplir",
};

export default async function ContratsPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Contrats"
      description="Tes contrats d'intermittence"
      actions={
        <Link href="/contrats/importer" className="btn-primary">
          <FilePlus2 size={18} aria-hidden /> Ajouter
        </Link>
      }
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;

  const [{ data }, lots, usage] = await Promise.all([
    db.supabase
      .from("contrats")
      .select("*, organisation:organisations(id, nom), projet:projets(id, nom)")
      .order("date_debut", { ascending: false })
      .returns<Contrat[]>(),
    chargerLots(db.supabase),
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

      {lots.length > 0 && (
        <section aria-labelledby="a-verifier" className="mb-8">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="a-verifier" className="text-lg font-semibold">
              À vérifier <span className="text-muted">({lots.length})</span>
            </h2>
            {lots.some((l) => l.statut !== "en_cours") && (
              <Link href={`/contrats/importer/${(lots.find((l) => l.statut !== "en_cours") ?? lots[0]).docs[0].id}`} className="text-sm font-medium text-accent">
                Commencer
              </Link>
            )}
          </div>
          <ul className="card divide-y divide-border overflow-hidden border-warning/40">
            {lots.map((lot) => {
              const e = lot.extraction;
              const titre = e ? titreContrat({ projet: e.projet.valeur, poste: e.poste.valeur, employeur: e.employeur_nom.valeur }) : lot.docs[0].nom_fichier;
              const detail = [
                e?.projet.valeur ? e.employeur_nom.valeur : null,
                e?.date_debut.valeur ? formatPeriode(e.date_debut.valeur, e.date_fin.valeur ?? e.date_debut.valeur) : null,
                lot.docs.length > 1 ? `${lot.docs.length} documents` : null,
              ].filter(Boolean);
              return (
                <li key={lot.docs[0].id}>
                  <Link href={`/contrats/importer/${lot.docs[0].id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{titre}</span>
                      {detail.length > 0 && <span className="block truncate text-sm text-muted">{detail.join(" · ")}</span>}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        lot.statut === "en_cours" ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning"
                      }`}
                    >
                      {lot.statut === "en_cours" && <Loader2 size={12} className="animate-spin" aria-hidden />}
                      {STATUT_IMPORT[lot.statut as keyof typeof STATUT_IMPORT] ?? ""}
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {lots.some((l) => l.statut === "en_cours") && <AutoRefresh intervalMs={4000} />}
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
                <p className="text-sm text-muted tabular-nums">
                  {[
                    `${formatNombre(liste.reduce((s, c) => s + Number(c.heures), 0))} h`,
                    liste.some((c) => c.cachets > 0) && `${liste.reduce((s, c) => s + c.cachets, 0)} cachet(s)`,
                    `${formatEuros(liste.reduce((s, c) => s + (c.salaire_brut ?? 0), 0))} brut`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <ul className="card divide-y divide-border overflow-hidden">
                {liste.map((c) => (
                  <li key={c.id}>
                    <Link href={`/contrats/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {titreContrat({ projet: c.projet?.nom, poste: c.poste, employeur: c.organisation?.nom })}
                        </p>
                        <p className="truncate text-sm text-muted">
                          {[c.projet?.nom ? c.organisation?.nom : null, formatPeriode(c.date_debut, c.date_fin)].filter(Boolean).join(" · ")}
                        </p>
                        {c.statut_aem === "a_recevoir" && c.date_fin < aujourdhui() && (
                          <span className="mt-1 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">AEM à recevoir</span>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-sm tabular-nums">
                        <p className="font-medium">
                          {c.cachets > 0 && Number(c.heures) === 0 ? `${c.cachets} cachet(s)` : `${formatNombre(Number(c.heures))} h`}
                        </p>
                        <p className="text-muted">{formatEuros(c.salaire_brut)}</p>
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
