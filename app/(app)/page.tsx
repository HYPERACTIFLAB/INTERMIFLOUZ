import Link from "next/link";
import { CalendarClock, ChevronRight, FileWarning, Gauge, Receipt, Wallet } from "lucide-react";
import { BarChart } from "@/components/bar-chart";
import { Bouton1312 } from "@/components/bouton-1312";
import { sousTitreContrat, titreContrat } from "@/lib/titre";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/data/db";
import { listNotes } from "@/lib/data/frais";
import { chargerLots } from "@/lib/data/imports";
import { chargerContratsCalcul, chargerRegles, chargerSituation } from "@/lib/data/intermittence";
import { NAV_ITEMS } from "@/lib/navigation";
import { echeanceAcces, googleConfigured } from "@/lib/google/config";
import { aujourdhui, joursInclus } from "@/lib/regles/dates";
import { compteur } from "@/lib/regles/intermittence";
import { salairesParMois } from "@/lib/regles/revenus";
import { formatDate, formatEuros, formatNombre, formatPeriode } from "@/lib/format";
import { marquerPaye } from "./contrats/actions";
import { marquerRembourse } from "./frais/actions";

function Tuile({
  href,
  icone: Icone,
  label,
  valeur,
  detail,
  alerte,
  children,
}: {
  href: string;
  icone: typeof Gauge;
  label: string;
  valeur: string;
  detail?: string;
  alerte?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="card block p-4 transition-colors hover:border-accent">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icone size={16} aria-hidden /> {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alerte ? "text-warning" : ""}`}>{valeur}</p>
      {children}
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </Link>
  );
}

export default async function AccueilPage() {
  const user = await getCurrentUser();
  const firstName = user.name?.split(" ")[0];
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date());
  const header = <PageHeader title={firstName ? `Bonjour ${firstName}` : "Bonjour"} description={today} actions={<Bouton1312 />} />;

  const db = await getDb();
  if (!db) {
    return (
      <>
        {header}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NAV_ITEMS.filter((i) => i.href !== "/").map((item) => (
            <li key={item.href} className="min-w-0">
              <Link href={item.href} className="card flex items-center gap-4 p-4">
                <item.icon size={20} className="text-accent" aria-hidden />
                <span className="flex-1 font-medium">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  const jour = aujourdhui();
  const [contrats, regles, situation, notes, lots, { data: google }] = await Promise.all([
    chargerContratsCalcul(db.supabase),
    chargerRegles(db.supabase),
    chargerSituation(db.supabase),
    listNotes(db.supabase),
    chargerLots(db.supabase),
    db.supabase.from("connexions_google").select("connecte_le, derniere_erreur").maybeSingle(),
  ]);
  // Google coupe l'accès tous les 7 jours (appli en mode Test) : rappel la veille, ou après une erreur.
  const ech = google && googleConfigured() ? echeanceAcces(google.connecte_le as string) : null;
  const reconnecterGoogle = ech && (ech.bientot || google?.derniere_erreur);

  const r = compteur(contrats, situation, regles, jour);
  const nonPercus = contrats.filter((c) => !c.paye && c.date_fin <= jour).sort((a, b) => a.date_fin.localeCompare(b.date_fin));
  const totalNonPercu = nonPercus.reduce((s, c) => s + (c.salaire_net ?? 0), 0);
  const aemManquantes = contrats.filter((c) => c.statut_aem === "a_recevoir" && c.date_fin <= jour);
  const aRembourser = notes.filter((n) => n.statut === "a_rembourser").sort((a, b) => a.date.localeCompare(b.date));
  const totalFrais = aRembourser.reduce((s, n) => s + n.montant_ttc, 0);
  const parMois = salairesParMois(contrats, jour);
  const total12 = parMois.reduce((s, m) => s + m.net, 0);
  const nomMois = (m: string) =>
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(m + "-01T00:00:00Z"));

  return (
    <>
      {header}

      <div className="space-y-6">
        {lots.length > 0 && (
          <Link href="/contrats" className="flex items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <FileWarning size={18} aria-hidden />
            <span className="flex-1">{lots.length} import(s) de contrats à vérifier</span>
            <ChevronRight size={18} aria-hidden />
          </Link>
        )}

        {reconnecterGoogle && (
          <a href="/api/google/connexion" className="flex items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <CalendarClock size={18} aria-hidden />
            <span className="flex-1">
              {ech!.expire || google?.derniere_erreur
                ? "Google Agenda est déconnecté (Google coupe l'accès tous les 7 jours). Appuie ici pour reconnecter."
                : "L'accès à Google Agenda expire demain. Appuie ici pour le prolonger de 7 jours."}
            </span>
            <ChevronRight size={18} aria-hidden />
          </a>
        )}

        {/* Chiffres clés */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tuile href="/intermittence" icone={Gauge} label="Heures" valeur={`${formatNombre(Math.round(r.total))} / ${r.seuil}`} detail={r.atteint ? "Seuil atteint" : `Il manque ${formatNombre(Math.ceil(r.manquant))} h`}>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent-soft" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (r.total / r.seuil) * 100)}%` }} />
            </div>
          </Tuile>
          <Tuile href="#salaires" icone={Wallet} label="À percevoir" valeur={formatEuros(totalNonPercu)} detail={`${nonPercus.length} salaire(s) net(s)`} alerte={nonPercus.length > 0} />
          <Tuile href="/frais" icone={Receipt} label="Frais à rembourser" valeur={formatEuros(totalFrais)} detail={`${aRembourser.length} note(s)`} alerte={aRembourser.length > 0} />
          <Tuile href="#aem" icone={FileWarning} label="AEM manquantes" valeur={String(aemManquantes.length)} detail="contrats terminés" alerte={aemManquantes.length > 0} />
        </div>

        {/* Graphique */}
        <section aria-labelledby="revenus" className="card p-4 md:p-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="revenus" className="font-semibold">Salaires nets par mois</h2>
            <p className="text-sm text-muted">12 derniers mois : <span className="font-medium text-foreground tabular-nums">{formatEuros(total12)}</span></p>
          </div>
          <BarChart
            barres={parMois.map((m) => ({
              cle: m.mois,
              libelle: nomMois(m.mois),
              court: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(new Date(m.mois + "-01T00:00:00Z")).replace(".", ""),
              valeur: m.net,
              detail: `${m.contrats} contrat(s)`,
            }))}
          />
          <p className="mt-2 text-xs text-muted">Selon les dates travaillées (pas la date de paiement). Allocations et micro-entreprise : prochaines étapes.</p>
        </section>

        {/* Salaires non perçus */}
        <section id="salaires" aria-labelledby="titre-salaires" className="scroll-mt-6">
          <h2 id="titre-salaires" className="mb-3 text-lg font-semibold">Salaires pas encore perçus</h2>
          {nonPercus.length === 0 ? (
            <p className="card p-4 text-sm text-muted">Tout est perçu. 👌</p>
          ) : (
            <ul className="card divide-y divide-border overflow-hidden">
              {nonPercus.map((c) => {
                const attente = joursInclus(c.date_fin, jour) - 1;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <Link href={`/contrats/${c.id}`} className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{titreContrat(c)}</span>
                      {sousTitreContrat(c) && <span className="block truncate text-sm text-muted">{sousTitreContrat(c)}</span>}
                      <span className={`block text-sm ${attente > 30 ? "text-warning" : "text-muted"}`}>
                        {formatPeriode(c.date_debut, c.date_fin)} · fini depuis {attente} j
                      </span>
                    </Link>
                    <span className="shrink-0 text-right text-sm font-medium tabular-nums">{c.salaire_net !== null ? formatEuros(c.salaire_net) : "—"}</span>
                    <form action={marquerPaye}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="paye" value="1" />
                      <SubmitButton className="btn-secondary px-3 py-1.5 text-sm" pendingLabel="…">Perçu</SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Notes de frais */}
        <section aria-labelledby="titre-frais">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="titre-frais" className="text-lg font-semibold">Notes de frais à rembourser</h2>
            <Link href="/frais" className="text-sm text-accent">Tout voir</Link>
          </div>
          {aRembourser.length === 0 ? (
            <p className="card p-4 text-sm text-muted">
              Rien en attente. <Link href="/frais" className="text-accent">Photographier un ticket</Link>
            </p>
          ) : (
            <ul className="card divide-y divide-border overflow-hidden">
              {aRembourser.slice(0, 6).map((n) => (
                <li key={n.id} className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/frais/${n.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{n.marchand ?? n.description ?? "Note de frais"}</span>
                    <span className="block truncate text-sm text-muted">
                      {formatDate(n.date)}
                      {n.projet?.nom ? ` · ${n.projet.nom}` : n.organisation?.nom ? ` · ${n.organisation.nom}` : ""}
                    </span>
                  </Link>
                  <span className="shrink-0 text-sm font-medium tabular-nums">{formatEuros(n.montant_ttc)}</span>
                  <form action={marquerRembourse}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="rembourse" value="1" />
                    <SubmitButton className="btn-secondary px-3 py-1.5 text-sm" pendingLabel="…">Remboursée</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AEM */}
        {aemManquantes.length > 0 && (
          <section id="aem" aria-labelledby="titre-aem" className="scroll-mt-6">
            <h2 id="titre-aem" className="mb-3 text-lg font-semibold">AEM à réclamer</h2>
            <ul className="card divide-y divide-border overflow-hidden">
              {aemManquantes.map((c) => (
                <li key={c.id}>
                  <Link href={`/contrats/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{titreContrat(c)}</span>
                      <span className="block truncate text-sm text-muted">
                        {[c.employeur, formatPeriode(c.date_debut, c.date_fin)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
