import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice, ErrorBanner } from "@/components/states";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { getDb } from "@/lib/data/db";
import { chargerContratsCalcul } from "@/lib/data/intermittence";
import { googleConfigured, NOM_AGENDA } from "@/lib/google/config";
import { blocsJours } from "@/lib/google/evenements";
import { ajouterJours, ajouterMois, aujourdhui, bornesMois } from "@/lib/regles/dates";
import { formatDate, formatNombre, formatPeriode } from "@/lib/format";
import { sousTitreContrat, titreContrat } from "@/lib/titre";
import { deconnecterGoogle, toutSynchroniser } from "./actions";

export const metadata = { title: "Agenda" };

const ERREURS: Record<string, string> = {
  config: "Google Agenda n'est pas encore configuré sur le serveur (voir le guide ci-dessous).",
  refus: "Tu as refusé l'accès dans Google. Rien n'a été connecté.",
  etat: "La connexion a expiré ou vient d'un autre navigateur. Recommence depuis cette page.",
  permission: "Il faut cocher la case « Créer des agendas secondaires… » dans la fenêtre Google. Recommence.",
  jeton: "Google n'a pas renvoyé d'accès durable. Recommence la connexion.",
  google: "Google a refusé la connexion. Vérifie l'adresse de redirection dans Google Cloud, puis recommence.",
  synchro: "Google est connecté, mais l'envoi des contrats a échoué. Réessaie avec « Tout renvoyer ».",
  inconnue: "Erreur inattendue pendant la connexion. Réessaie.",
};

const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const sp = await searchParams;
  const db = await getDb();
  const header = <PageHeader title="Agenda" description="Tes jours de tournage, envoyés dans Google Agenda" />;
  if (!db) return <>{header}<DemoNotice /></>;

  const jour = aujourdhui();
  const mois = typeof sp.mois === "string" && /^\d{4}-\d{2}$/.test(sp.mois) ? sp.mois : jour.slice(0, 7);
  const { debut, fin } = bornesMois(mois);

  const [contrats, { data: connexion }] = await Promise.all([
    chargerContratsCalcul(db.supabase),
    db.supabase.from("connexions_google").select("derniere_synchro, derniere_erreur, connecte_le").maybeSingle(),
  ]);

  // Jours travaillés de chaque contrat sur le mois affiché.
  const parJour = new Map<string, typeof contrats>();
  for (const c of contrats) {
    for (const [d, f] of blocsJours({ ...c, jours_travailles: c.jours_travailles ?? [] })) {
      for (let j = d; j <= f; j = ajouterJours(j, 1)) {
        if (j < debut || j > fin) continue;
        parJour.set(j, [...(parJour.get(j) ?? []), c]);
      }
    }
  }
  const duMois = contrats.filter((c) => c.date_debut <= fin && c.date_fin >= debut);
  const joursTravailles = parJour.size;

  // Grille du lundi au dimanche.
  const decalage = (new Date(debut + "T00:00:00Z").getUTCDay() + 6) % 7;
  const cases: (string | null)[] = Array(decalage).fill(null);
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) cases.push(j);
  const titreMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(debut + "T00:00:00Z"));

  const erreur = typeof sp.erreur === "string" ? (ERREURS[sp.erreur] ?? ERREURS.inconnue) : null;

  return (
    <>
      {header}
      <div className="space-y-6">
        <ErrorBanner message={erreur} />
        {typeof sp.connecte === "string" && (
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
            Google Agenda est connecté. {sp.connecte} contrat(s) envoyé(s) dans l&apos;agenda « {NOM_AGENDA} ».
          </p>
        )}
        {typeof sp.envoye === "string" && (
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{sp.envoye} contrat(s) renvoyé(s) dans Google Agenda.</p>
        )}

        {/* Calendrier du mois */}
        <section aria-labelledby="mois" className="card p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Link href={`/agenda?mois=${ajouterMois(debut, -1).slice(0, 7)}`} className="rounded-lg p-2 text-muted hover:bg-background" aria-label="Mois précédent">
              <ChevronLeft size={20} />
            </Link>
            <div className="text-center">
              <h2 id="mois" className="font-semibold first-letter:uppercase">{titreMois}</h2>
              <p className="text-xs text-muted">{joursTravailles} jour(s) travaillé(s)</p>
            </div>
            <Link href={`/agenda?mois=${ajouterMois(debut, 1).slice(0, 7)}`} className="rounded-lg p-2 text-muted hover:bg-background" aria-label="Mois suivant">
              <ChevronRight size={20} />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {JOURS.map((j) => (
              <div key={j} className="pb-1">{j}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cases.map((j, i) => {
              if (!j) return <div key={`vide-${i}`} />;
              const liste = parJour.get(j) ?? [];
              const contenu = (
                <>
                  <span className={`text-sm tabular-nums ${j === jour ? "font-bold text-accent" : ""}`}>{Number(j.slice(8))}</span>
                  {liste.length > 0 && (
                    <span className="mt-0.5 hidden w-full truncate rounded bg-accent px-1 text-[10px] leading-4 text-white sm:block">
                      {titreContrat(liste[0])}
                    </span>
                  )}
                  {liste.length > 0 && <span className="mt-1 size-1.5 rounded-full bg-accent sm:hidden" aria-hidden />}
                </>
              );
              const classes = `flex min-h-12 min-w-0 flex-col items-center rounded-lg p-1 sm:min-h-16 ${
                liste.length ? "bg-accent-soft" : ""
              } ${j === jour ? "ring-1 ring-accent" : ""}`;
              return liste.length ? (
                <Link key={j} href={`/contrats/${liste[0].id}`} className={`${classes} hover:ring-1 hover:ring-accent`} title={liste.map((c) => titreContrat(c)).join(", ")}>
                  {contenu}
                </Link>
              ) : (
                <div key={j} className={classes}>{contenu}</div>
              );
            })}
          </div>
        </section>

        {/* Contrats du mois */}
        <section aria-labelledby="contrats-mois">
          <h2 id="contrats-mois" className="mb-3 text-lg font-semibold">Contrats du mois</h2>
          {duMois.length === 0 ? (
            <p className="card p-4 text-sm text-muted">Aucun contrat ce mois-ci.</p>
          ) : (
            <ul className="card divide-y divide-border overflow-hidden">
              {duMois.map((c) => (
                <li key={c.id}>
                  <Link href={`/contrats/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{titreContrat(c)}</span>
                      <span className="block truncate text-sm text-muted">
                        {[sousTitreContrat(c), formatPeriode(c.date_debut, c.date_fin)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">
                      {[c.jours_travailles?.length && `${c.jours_travailles.length} j`, Number(c.heures) > 0 && `${formatNombre(Number(c.heures))} h`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Google Agenda */}
        <section aria-labelledby="google" className="card p-5 md:p-6">
          <h2 id="google" className="flex items-center gap-2 font-semibold">
            <CalendarCheck size={18} className="text-accent" aria-hidden /> Google Agenda
          </h2>
          {!googleConfigured() ? (
            <div className="mt-2 space-y-2 text-sm text-muted">
              <p>Pas encore configuré. Une fois fait, chaque contrat enregistré apparaîtra automatiquement dans un agenda « {NOM_AGENDA} ».</p>
              <p>
                La marche à suivre (à faire une fois, depuis l&apos;ordi) est dans le README, section « Google Agenda ».
              </p>
            </div>
          ) : !connexion ? (
            <div className="mt-2 space-y-3 text-sm">
              <p className="text-muted">
                L&apos;appli créera son propre agenda « {NOM_AGENDA} » dans ton Google Agenda et y mettra tes jours de tournage. Elle ne
                peut ni lire ni modifier tes autres agendas.
              </p>
              {/* Lien classique (pas de préchargement) : on part chez Google. */}
              <a href="/api/google/connexion" className="btn-primary inline-flex">Connecter Google Agenda</a>
              <p className="text-xs text-muted">
                À faire de préférence depuis l&apos;ordinateur. Google peut afficher « Application non validée » : clique sur « Paramètres
                avancés » puis « Accéder à Intermiflouze ». C&apos;est normal pour une appli personnelle.
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-3 text-sm">
              <p>
                Connecté. Chaque contrat enregistré, modifié ou supprimé est mis à jour dans l&apos;agenda « {NOM_AGENDA} ».
              </p>
              <p className="text-muted">
                {connexion.derniere_synchro
                  ? `Dernier envoi : ${formatDate(connexion.derniere_synchro as string, "long")} à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(connexion.derniere_synchro as string))}.`
                  : "Aucun envoi pour l'instant."}
              </p>
              {connexion.derniere_erreur && (
                <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-danger">
                  Dernier envoi en échec : {connexion.derniere_erreur as string}{" "}
                  <a href="/api/google/connexion" className="font-medium underline">Reconnecter Google</a>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <form action={toutSynchroniser}>
                  <SubmitButton className="btn-secondary" pendingLabel="Envoi…">
                    <span className="inline-flex items-center gap-2"><RefreshCw size={16} aria-hidden /> Tout renvoyer</span>
                  </SubmitButton>
                </form>
                <form action={deconnecterGoogle}>
                  <ConfirmButton
                    className="btn-secondary text-danger"
                    message="Déconnecter Google Agenda ? L'agenda « Intermiflouze » restera dans Google, tu pourras le supprimer toi-même."
                  >
                    Déconnecter
                  </ConfirmButton>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
