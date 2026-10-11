import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { chargerContratsCalcul, chargerRegles } from "@/lib/data/intermittence";
import { recapMois } from "@/lib/regles/intermittence";
import { ajouterMois, aujourdhui } from "@/lib/regles/dates";
import { formatDate, formatEuros, formatNombre, formatPeriode } from "@/lib/format";
import { Copier } from "./copier";

export const metadata = { title: "Récap d'actualisation" };

function nomMois(mois: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(mois + "-01T00:00:00Z"));
}

export default async function ActualisationPage({ searchParams }: PageProps<"/intermittence/actualisation">) {
  const { mois: moisParam } = await searchParams;
  // Par défaut : le mois précédent (c'est lui qu'on déclare en début de mois).
  const defaut = ajouterMois(aujourdhui(), -1).slice(0, 7);
  const mois = typeof moisParam === "string" && /^\d{4}-\d{2}$/.test(moisParam) ? moisParam : defaut;
  const precedent = ajouterMois(mois + "-01", -1).slice(0, 7);
  const suivant = ajouterMois(mois + "-01", 1).slice(0, 7);

  const db = await getDb();
  const header = (
    <PageHeader title="Récap d'actualisation" description="Ce qu'il faut déclarer à France Travail" back={{ href: "/intermittence", label: "Intermittence" }} />
  );
  if (!db) return <>{header}<DemoNotice /></>;

  const [contrats, regles] = await Promise.all([chargerContratsCalcul(db.supabase), chargerRegles(db.supabase)]);
  const r = recapMois(contrats, mois, regles);

  const texte = [
    `Actualisation ${nomMois(mois)}`,
    r.lignes.length ? "A travaillé : oui" : "A travaillé : non",
    ...r.lignes.map(
      (l) =>
        `- ${l.contrat.employeur ?? "Employeur ?"} : du ${formatDate(l.debut)} au ${formatDate(l.fin)}, ${formatNombre(l.heures)} h, ${formatEuros(l.brut)} brut`,
    ),
    `Total : ${formatNombre(r.heures)} h, ${formatEuros(r.brut)} brut`,
    "Chiffre d'affaires micro-entreprise : à compléter (étape d)",
  ].join("\n");

  return (
    <>
      {header}

      <nav className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-surface p-2" aria-label="Choix du mois">
        <Link href={`?mois=${precedent}`} className="rounded-xl p-2 text-muted hover:bg-background" aria-label="Mois précédent">
          <ChevronLeft size={20} />
        </Link>
        <span className="font-medium capitalize">{nomMois(mois)}</span>
        <Link href={`?mois=${suivant}`} className="rounded-xl p-2 text-muted hover:bg-background" aria-label="Mois suivant">
          <ChevronRight size={20} />
        </Link>
      </nav>

      <div className="space-y-6">
        <dl className="card grid grid-cols-3 divide-x divide-border text-center">
          {[
            ["Heures", `${formatNombre(r.heures)} h`],
            ["Jours", String(r.jours)],
            ["Brut", formatEuros(r.brut)],
          ].map(([l, val]) => (
            <div key={l} className="px-2 py-4">
              <dt className="text-xs text-muted">{l}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{val}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="employeurs">
          <h2 id="employeurs" className="mb-3 text-lg font-semibold">
            {r.lignes.length ? `Employeurs à déclarer (${r.employeurs.length})` : "Aucun travail ce mois-ci"}
          </h2>
          {r.lignes.length > 0 && (
            <ul className="card divide-y divide-border overflow-hidden">
              {r.lignes.map((l) => (
                <li key={l.contrat.id}>
                  <Link href={`/contrats/${l.contrat.id}`} className="block px-4 py-3 hover:bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{l.contrat.employeur ?? "Employeur non renseigné"}</span>
                        <span className="block text-sm text-muted">{formatPeriode(l.debut, l.fin)} · {l.jours} jour(s)</span>
                      </span>
                      <span className="shrink-0 text-right text-sm tabular-nums">
                        <span className="block font-medium">{formatNombre(l.heures)} h</span>
                        <span className="block text-muted">{formatEuros(l.brut)}</span>
                      </span>
                    </div>
                    {l.partiel && <p className="mt-1 text-xs text-warning">Contrat à cheval sur deux mois : heures et salaire répartis au prorata.</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4 text-sm">
          <p className="font-medium">Micro-entreprise</p>
          <p className="mt-1 text-muted">Le chiffre d&apos;affaires du mois s&apos;affichera ici à l&apos;étape d (micro-entreprise).</p>
        </section>

        <Copier texte={texte} />
        <p className="text-xs text-muted">
          Vérifie toujours avec tes bulletins et AEM avant de valider ton actualisation sur France Travail.
        </p>
      </div>
    </>
  );
}
