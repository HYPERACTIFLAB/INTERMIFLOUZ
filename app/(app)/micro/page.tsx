import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronRight, ExternalLink, FilePlus2, Landmark, ReceiptText, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { getDb } from "@/lib/data/db";
import { chargerRegles } from "@/lib/data/intermittence";
import { chargerEntreprise, infosManquantes, listFactures, listPaiements, moisDeclares, resteDu } from "@/lib/data/micro";
import { aujourdhui } from "@/lib/regles/dates";
import { v } from "@/lib/regles/regles";
import { caParMois, echeancesUrssaf, enRetard, plafondAnnee, type Echeance } from "@/lib/micro/calcul";
import { formatDate, formatEuros, formatNombre } from "@/lib/format";
import { annulerDeclaration, marquerDeclare } from "./actions";

export const metadata = { title: "Micro-entreprise" };

const nomMois = (m: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat("fr-FR", { month: style, year: "numeric", timeZone: "UTC" }).format(new Date(m + "-01T00:00:00Z"));
const periode = (e: Echeance) => (e.mois.length === 1 ? nomMois(e.mois[0]) : `${nomMois(e.mois[0], "short")} → ${nomMois(e.mois[e.mois.length - 1], "short")}`);

function Jauge({ libelle, valeur, max, detail }: { libelle: string; valeur: number; max: number; detail: string }) {
  const pct = Math.min(100, (valeur / max) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">{libelle}</span>
        <span className="tabular-nums">
          <span className="font-medium">{formatEuros(valeur)}</span> / {formatEuros(max)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-accent-soft" aria-hidden>
        <div className={`h-full rounded-full ${pct > 90 ? "bg-warning" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

export default async function MicroPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Micro-entreprise"
      description="Chiffre d'affaires encaissé, déclarations URSSAF et plafonds"
      actions={
        <>
          <Link href="/micro/factures/nouvelle" className="btn-primary">
            <FilePlus2 size={18} aria-hidden /> Facture
          </Link>
          <Link href="/micro/devis/nouveau" className="btn-secondary">
            Devis
          </Link>
        </>
      }
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;

  const [entreprise, regles, paiements, factures, declares] = await Promise.all([
    chargerEntreprise(db.supabase),
    chargerRegles(db.supabase),
    listPaiements(db.supabase),
    listFactures(db.supabase),
    moisDeclares(db.supabase),
  ]);
  const jour = aujourdhui();
  const debut = entreprise.date_debut_activite ?? jour;
  const ca = caParMois(paiements);
  const echeances = echeancesUrssaf(debut, jour, ca, new Set(declares.map((d) => d.mois)), regles);
  const prochaine = echeances.find((e) => e.statut === "a_faire" || e.statut === "en_retard");
  const suivante = echeances.find((e) => e.statut === "a_venir");
  const annee = Number(jour.slice(0, 4));
  const caAnnee = [...ca.entries()].filter(([m]) => m.startsWith(String(annee))).reduce((s, [, c]) => s + c, 0);
  const caMois = ca.get(jour.slice(0, 7)) ?? 0;
  const aEncaisser = factures.filter((f) => f.statut === "emise");
  const totalAEncaisser = aEncaisser.reduce((s, f) => s + resteDu(f), 0);
  const manquent = infosManquantes(entreprise);

  return (
    <>
      {header}
      <div className="space-y-6">
        {manquent.length > 0 && (
          <Link href="/parametres" className="flex items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertTriangle size={18} className="shrink-0" aria-hidden />
            <span className="flex-1">Avant ta première facture, complète tes Paramètres : {manquent.join(", ")}.</span>
            <ChevronRight size={18} aria-hidden />
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="card p-4">
            <p className="flex items-center gap-2 text-sm text-muted"><Wallet size={16} aria-hidden /> Encaissé ce mois-ci</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatEuros(caMois)}</p>
          </div>
          <div className="card p-4">
            <p className="flex items-center gap-2 text-sm text-muted"><Landmark size={16} aria-hidden /> Encaissé en {annee}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatEuros(caAnnee)}</p>
          </div>
          <Link href="/micro/factures" className="card p-4 hover:border-accent">
            <p className="flex items-center gap-2 text-sm text-muted"><ReceiptText size={16} aria-hidden /> À encaisser</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${aEncaisser.some((f) => enRetard(f, jour)) ? "text-warning" : ""}`}>
              {formatEuros(totalAEncaisser)}
            </p>
            <p className="text-xs text-muted">{aEncaisser.length} facture(s)</p>
          </Link>
          <div className="card p-4">
            <p className="flex items-center gap-2 text-sm text-muted"><CalendarClock size={16} aria-hidden /> Prochaine déclaration</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {prochaine ? formatDate(prochaine.date_limite) : suivante ? formatDate(suivante.date_limite) : "—"}
            </p>
            <p className="text-xs text-muted">
              {prochaine
                ? `${formatEuros(prochaine.montant)} à payer`
                : suivante
                  ? `environ ${formatEuros(suivante.montant)} à prévoir (période en cours)`
                  : "rien à déclarer pour l'instant"}
            </p>
          </div>
        </div>

        {/* Déclaration à faire */}
        {prochaine && (
          <section className={`card p-4 md:p-6 ${prochaine.statut === "en_retard" ? "border-danger/50" : "border-warning/50"}`} aria-labelledby="a-declarer">
            <h2 id="a-declarer" className="font-semibold">
              Déclaration URSSAF à faire {prochaine.statut === "en_retard" ? "(en retard)" : `avant le ${formatDate(prochaine.date_limite, "long")}`}
            </h2>
            <p className="mt-1 text-sm text-muted first-letter:uppercase">{periode(prochaine)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-background p-3">
                <dt className="text-muted">Chiffre d&apos;affaires à déclarer</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatEuros(prochaine.ca)}</dd>
              </div>
              <div className="rounded-xl bg-background p-3">
                <dt className="text-muted">À payer (environ {formatNombre(Math.round(prochaine.taux * 100) / 100)} %)</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatEuros(prochaine.montant)}</dd>
              </div>
            </dl>
            {prochaine.mois.length > 1 && (
              <ul className="mt-2 text-xs text-muted">
                {prochaine.mois.map((m) => (
                  <li key={m}>
                    <span className="first-letter:uppercase">{nomMois(m)}</span> : {formatEuros(ca.get(m) ?? 0)}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">
              {prochaine.ca === 0 ? "Même sans chiffre d'affaires, il faut déclarer 0 €. " : ""}
              Sur autoentrepreneur.urssaf.fr, déclare le montant en « prestations de services BIC », avec le versement libératoire.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <ExternalLink size={16} aria-hidden /> Ouvrir le site de l&apos;URSSAF
              </a>
              <form action={marquerDeclare}>
                {prochaine.mois.map((m) => (
                  <span key={m}>
                    <input type="hidden" name="mois" value={m} />
                    <input type="hidden" name="ca" value={ca.get(m) ?? 0} />
                  </span>
                ))}
                <input type="hidden" name="montant" value={prochaine.montant} />
                <SubmitButton pendingLabel="…">C&apos;est déclaré</SubmitButton>
              </form>
            </div>
          </section>
        )}

        {/* Plafonds */}
        <section className="card space-y-4 p-4 md:p-6" aria-label="Plafonds">
          <Jauge
            libelle={`Plafond micro-entreprise ${annee}`}
            valeur={caAnnee}
            max={plafondAnnee(regles, annee, debut)}
            detail={
              Number(debut.slice(0, 4)) === annee
                ? `Proratisé depuis ton début d'activité (${formatDate(debut)}) : ${formatEuros(v(regles, "micro_plafond_ca") * 100)} sur une année entière.`
                : "Au-delà deux années de suite, sortie du régime micro."
            }
          />
          <Jauge
            libelle="Franchise de TVA"
            valeur={caAnnee}
            max={v(regles, "micro_seuil_tva") * 100}
            detail={`Au-delà de ${formatEuros(v(regles, "micro_seuil_tva_majore") * 100)}, il faut facturer la TVA. Tant que tu restes dessous, la mention « TVA non applicable » suffit.`}
          />
        </section>

        {/* Historique des déclarations */}
        <section aria-labelledby="historique">
          <h2 id="historique" className="mb-3 text-lg font-semibold">Déclarations</h2>
          <ul className="card divide-y divide-border overflow-hidden">
            {[...echeances].reverse().map((e) => (
              <li key={e.date_limite} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium first-letter:uppercase">{periode(e)}</span>
                  <span className="block text-sm text-muted">
                    avant le {formatDate(e.date_limite)} · CA {formatEuros(e.ca)} · {formatEuros(e.montant)} à payer
                  </span>
                </span>
                {e.statut === "faite" ? (
                  <form action={annulerDeclaration} className="text-right">
                    {e.mois.map((m) => (
                      <input key={m} type="hidden" name="mois" value={m} />
                    ))}
                    <span className="block rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Déclarée</span>
                    <ConfirmButton className="text-xs text-muted underline" message="Marquer cette période comme non déclarée ?">
                      annuler
                    </ConfirmButton>
                  </form>
                ) : (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      e.statut === "en_retard" ? "bg-danger/10 text-danger" : e.statut === "a_faire" ? "bg-warning-soft text-warning" : "bg-background text-muted"
                    }`}
                  >
                    {e.statut === "en_retard" ? "En retard" : e.statut === "a_faire" ? "À faire" : "En cours"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Taux appliqués : cotisations {formatNombre(v(regles, "micro_taux_cotisations"))} %, impôt (versement libératoire){" "}
            {formatNombre(v(regles, "micro_taux_vl"))} %, formation {formatNombre(v(regles, "micro_taux_cfp"))} %, chambre de métiers{" "}
            {formatNombre(v(regles, "micro_taux_cma"))} % à partir de la 2e année. <Link href="/regles" className="text-accent">Modifier</Link>
          </p>
        </section>
      </div>
    </>
  );
}
