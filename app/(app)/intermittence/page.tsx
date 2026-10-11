import Link from "next/link";
import { CalendarClock, ChevronRight, ClipboardList, Info, SlidersHorizontal, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { chargerContratsCalcul, chargerRegles, chargerSituation } from "@/lib/data/intermittence";
import { allocationJournaliere, compteur } from "@/lib/regles/intermittence";
import { aujourdhui } from "@/lib/regles/dates";
import { AVERTISSEMENT_REGLES } from "@/lib/regles/regles";
import { formatDate, formatEuros, formatNombre, formatPeriode } from "@/lib/format";
import { SituationForm } from "./situation-form";

export const metadata = { title: "Intermittence" };

export default async function IntermittencePage() {
  const db = await getDb();
  const header = <PageHeader title="Intermittence" description="Ton compteur d'heures vers les 507 h" />;
  if (!db) return <>{header}<DemoNotice /></>;

  const [contrats, regles, situation] = await Promise.all([
    chargerContratsCalcul(db.supabase),
    chargerRegles(db.supabase),
    chargerSituation(db.supabase),
  ]);
  const jour = aujourdhui();
  const r = compteur(contrats, situation, regles, jour);
  const pct = Math.min(100, (r.total / r.seuil) * 100);
  const pctAcquis = Math.min(100, (r.heures / r.seuil) * 100);
  const aj = allocationJournaliere(r.brut / 100, Math.min(r.total, Infinity), regles);
  const reglesAVerifier = Object.entries(regles).filter(
    ([k, v]) => k !== "_modifiees" && (v as { a_verifier?: boolean }).a_verifier,
  ).length;

  return (
    <>
      {header}

      <div className="space-y-6">
        {/* Compteur */}
        <section aria-labelledby="compteur" className="card p-5 md:p-6">
          <h2 id="compteur" className="text-sm font-medium text-muted">
            {r.renouvellement ? `Heures pour le renouvellement au ${formatDate(r.fin, "long")}` : "Heures sur les 12 derniers mois"}
          </h2>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-tight tabular-nums">{formatNombre(Math.round(r.total))}</span>
            <span className="text-lg text-muted">/ {r.seuil} h</span>
          </p>

          <div
            className="relative mt-4 h-3 overflow-hidden rounded-full bg-accent-soft"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={r.seuil}
            aria-valuenow={Math.round(r.total)}
            aria-label="Heures retenues sur 507"
          >
            {r.heuresPrevues > 0 && (
              <div className="absolute inset-y-0 left-0 rounded-full bg-accent/40" style={{ width: `${pct}%` }} />
            )}
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pctAcquis}%` }} />
          </div>

          <p className="mt-3 text-sm">
            {r.atteint ? (
              <span className="font-medium text-accent">Seuil atteint 🎉</span>
            ) : (
              <>
                Il manque <span className="font-semibold tabular-nums">{formatNombre(Math.ceil(r.manquant))} h</span>.
              </>
            )}
            {r.heuresPrevues > 0 && (
              <span className="text-muted">
                {" "}
                Dont {formatNombre(Math.round(r.heuresPrevues))} h de contrats à venir (plus clair).
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">Période : {formatPeriode(r.debut, r.fin)}</p>
        </section>

        {/* Projection et estimation */}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
              <TrendingUp size={16} aria-hidden /> Projection
            </h2>
            <p className="mt-2 text-sm">
              Rythme des 6 derniers mois : <span className="font-semibold tabular-nums">{r.projection.parMois} h/mois</span>.
            </p>
            {r.renouvellement ? (
              <p className="mt-1 text-sm">
                À ce rythme, tu aurais environ{" "}
                <span className="font-semibold tabular-nums">{formatNombre(r.projection.estimeALaDate ?? r.total)} h</span> au{" "}
                {formatDate(r.fin)}
                {(r.projection.estimeALaDate ?? 0) >= r.seuil ? " : c'est bon." : ` : il en faut ${r.seuil}.`}
              </p>
            ) : r.atteint ? (
              <p className="mt-1 text-sm">Tu peux demander l&apos;ouverture de tes droits.</p>
            ) : r.projection.dateEstimee ? (
              <p className="mt-1 text-sm">
                Tu atteindrais les {r.seuil} h vers le <span className="font-semibold">{formatDate(r.projection.dateEstimee, "long")}</span>.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Pas assez de contrats récents pour estimer une date.</p>
            )}
            <p className="mt-2 text-xs text-muted">Estimation simple, sans tenir compte des heures qui sortent de la période.</p>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
              <CalendarClock size={16} aria-hidden /> Allocation journalière estimée
            </h2>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{formatEuros(Math.round(aj.finale * 100))}</p>
            <p className="mt-1 text-xs text-muted">
              Avec {formatNombre(Math.round(r.total))} h et {formatEuros(r.brut)} de salaires bruts sur la période.
              {aj.borne === "plancher" && " Montant minimum appliqué."}
              {aj.borne === "plafond" && " Montant maximum appliqué."}
              {situation.aj_actuelle !== null && ` Aujourd'hui : ${formatEuros(Math.round(situation.aj_actuelle * 100))}.`}
            </p>
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer">Détail du calcul</summary>
              <p className="mt-1 tabular-nums">
                A (salaires) {formatNombre(aj.A)} € + B (heures) {formatNombre(aj.B)} € + C (fixe) {formatNombre(aj.C)} € ={" "}
                {formatNombre(aj.brute)} €
              </p>
            </details>
            {r.sansSalaire > 0 && (
              <p className="mt-2 text-xs text-warning">{r.sansSalaire} contrat(s) sans salaire brut : l&apos;estimation est trop basse.</p>
            )}
          </section>
        </div>

        {reglesAVerifier > 0 && (
          <Link href="/regles" className="flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span className="flex-1">
              {reglesAVerifier} règle(s) de calcul à vérifier (montants 2026 non confirmés). {AVERTISSEMENT_REGLES}
            </span>
            <ChevronRight size={18} className="shrink-0" aria-hidden />
          </Link>
        )}

        {/* Liens */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/intermittence/actualisation" className="card flex items-center gap-4 p-4 hover:border-accent">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <ClipboardList size={20} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block font-medium">Récap d&apos;actualisation</span>
              <span className="block text-sm text-muted">Heures, employeurs et salaires du mois</span>
            </span>
            <ChevronRight size={18} className="text-muted" aria-hidden />
          </Link>
          <Link href="/regles" className="card flex items-center gap-4 p-4 hover:border-accent">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <SlidersHorizontal size={20} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block font-medium">Règles de calcul</span>
              <span className="block text-sm text-muted">Seuils, formules et sources</span>
            </span>
            <ChevronRight size={18} className="text-muted" aria-hidden />
          </Link>
        </div>

        {/* Contrats comptés */}
        <section aria-labelledby="comptes">
          <h2 id="comptes" className="mb-3 text-lg font-semibold">Contrats comptés ({r.parts.length})</h2>
          {r.parts.length === 0 ? (
            <p className="card p-4 text-sm text-muted">Aucun contrat sur la période. Importe tes contrats dans la rubrique Contrats.</p>
          ) : (
            <ul className="card divide-y divide-border overflow-hidden">
              {r.parts.map((p) => (
                <li key={p.contrat.id}>
                  <Link href={`/contrats/${p.contrat.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.contrat.employeur ?? "Employeur non renseigné"}</span>
                      <span className="block text-sm text-muted">
                        {formatPeriode(p.contrat.date_debut, p.contrat.date_fin)}
                        {p.part < 1 && ` · ${Math.round(p.part * 100)} % dans la période`}
                        {p.contrat.date_debut > jour && " · à venir"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      <span className="block font-medium">{formatNombre(Math.round(p.heures * 10) / 10)} h</span>
                      <span className="block text-muted">{formatEuros(Math.round(p.brut))}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Situation */}
        <section aria-labelledby="situation" className="card p-5 md:p-6">
          <h2 id="situation" className="mb-4 text-lg font-semibold">Ta situation</h2>
          <SituationForm
            droitsOuverts={situation.droits_ouverts}
            dateOuverture={situation.date_ouverture}
            dateAnniversaire={situation.date_anniversaire}
            ajActuelle={situation.aj_actuelle}
          />
        </section>
      </div>
    </>
  );
}
