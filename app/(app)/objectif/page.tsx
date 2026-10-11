import Link from "next/link";
import { CalendarClock, CheckCircle2, Info, Target, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { chargerContratsCalcul, chargerRegles, chargerSituation } from "@/lib/data/intermittence";
import { aujourdhui, joursInclus } from "@/lib/regles/dates";
import { compteur } from "@/lib/regles/intermittence";
import { moyennesContrats, objectifAllocation } from "@/lib/regles/objectif";
import { AVERTISSEMENT_REGLES } from "@/lib/regles/regles";
import { formatDate, formatEuros, formatNombre } from "@/lib/format";
import { ObjectifForm } from "./objectif-form";

export const metadata = { title: "Objectif ARE" };

const euros = (e: number) => formatEuros(Math.round(e * 100));

function Chiffre({ valeur, label }: { valeur: string; label: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-background p-3">
      <p className="text-xl font-semibold tabular-nums">{valeur}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function ObjectifPage() {
  const db = await getDb();
  const header = <PageHeader title="Objectif ARE" description="Choisis l'allocation que tu vises, l'appli calcule ce qu'il te reste à faire" />;
  if (!db) return <>{header}<DemoNotice /></>;

  const [contrats, regles, situation] = await Promise.all([
    chargerContratsCalcul(db.supabase),
    chargerRegles(db.supabase),
    chargerSituation(db.supabase),
  ]);
  const jour = aujourdhui();
  const r = compteur(contrats, situation, regles, jour);
  const moyennes = moyennesContrats(contrats);
  const taux = situation.objectif_taux_horaire !== null ? situation.objectif_taux_horaire / 100 : (moyennes.tauxHoraire ?? 0);
  const heuresJour = situation.objectif_heures_jour ?? moyennes.heuresParJour ?? 8;
  const cible = situation.objectif_aj;
  const o = cible ? objectifAllocation({ cible, heures: r.total, brut: r.brut / 100, tauxHoraire: taux, heuresParJour: heuresJour }, regles) : null;

  // Temps restant : jusqu'à la date anniversaire si les droits sont ouverts.
  const joursRestants = r.renouvellement && r.fin > jour ? joursInclus(jour, r.fin) - 1 : null;
  const moisRestants = joursRestants !== null ? joursRestants / 30.44 : null;

  return (
    <>
      {header}
      <div className="space-y-6">
        <section className="card p-5 md:p-6">
          <ObjectifForm
            cible={cible}
            taux={situation.objectif_taux_horaire !== null ? situation.objectif_taux_horaire / 100 : null}
            heuresJour={situation.objectif_heures_jour}
            tauxMoyen={moyennes.tauxHoraire}
            heuresJourMoyen={moyennes.heuresParJour}
          />
        </section>

        {o && (
          <section aria-labelledby="resultat" className="card p-5 md:p-6">
            <h2 id="resultat" className="flex items-center gap-2 text-sm font-medium text-muted">
              <Target size={16} aria-hidden /> Pour toucher {euros(cible!)} par jour
            </h2>

            {o.statut === "atteint" && (
              <p className="mt-3 flex items-center gap-2 text-lg font-semibold text-accent">
                <CheckCircle2 size={22} aria-hidden /> C&apos;est déjà bon : ton estimation est de {euros(o.actuelle)} par jour.
              </p>
            )}

            {o.statut === "au_dessus_plafond" && (
              <p className="mt-3 text-sm">
                Impossible : l&apos;allocation est plafonnée à <span className="font-semibold">{euros(o.plafond)}</span> par jour.
              </p>
            )}

            {o.statut === "hors_atteinte" && (
              <p className="mt-3 text-sm">
                Hors d&apos;atteinte avec un salaire de {euros(taux)} brut par heure (on plafonne vers {euros(o.maxAvecTaux)}).
                Essaie avec un salaire horaire plus élevé.
              </p>
            )}

            {o.statut === "a_faire" && (
              <>
                <p className="mt-3 text-lg">
                  Il te reste environ{" "}
                  <span className="font-semibold tabular-nums">{formatNombre(o.heures)} h</span>
                  {o.jours !== null && (
                    <>
                      {" "}
                      soit <span className="font-semibold tabular-nums">{o.jours} jours</span> de {formatNombre(heuresJour)} h
                    </>
                  )}
                  , payés {euros(taux)} brut de l&apos;heure.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Chiffre valeur={`${formatNombre(o.heures)} h`} label="heures en plus" />
                  <Chiffre valeur={o.jours !== null ? `${o.jours} j` : "—"} label="jours de travail" />
                  <Chiffre valeur={formatEuros(o.brut * 100)} label="salaires bruts en plus" />
                  <Chiffre valeur={euros(o.actuelle)} label={o.seuilAtteint ? "estimation actuelle / jour" : "aujourd'hui (sans les 507 h)"} />
                </div>

                {moisRestants !== null && o.jours !== null && (
                  <p className="mt-4 flex items-start gap-2 text-sm">
                    <CalendarClock size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                    <span>
                      D&apos;ici ta date anniversaire ({formatDate(r.fin, "long")}),{" "}
                      {moisRestants >= 1 ? (
                        <>
                          ça fait environ <span className="font-semibold">{Math.ceil(o.jours / moisRestants)} jours par mois</span>.
                          {o.jours / moisRestants > 22 && (
                            <span className="text-warning"> Plus de 22 jours par mois : difficile à ce salaire horaire.</span>
                          )}
                        </>
                      ) : (
                        <>il reste {joursRestants} jours : ça risque d&apos;être juste.</>
                      )}
                    </span>
                  </p>
                )}
                {moisRestants === null && r.projection.parMois > 0 && (
                  <p className="mt-4 flex items-start gap-2 text-sm">
                    <TrendingUp size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                    <span>
                      À ton rythme actuel ({r.projection.parMois} h par mois), compte environ{" "}
                      <span className="font-semibold">{Math.max(1, Math.ceil(o.heures / r.projection.parMois))} mois</span>.
                    </span>
                  </p>
                )}

                <ul className="mt-4 space-y-2 text-sm text-muted">
                  <li>
                    Au total sur la période : {formatNombre(o.totalHeures)} h et {formatEuros(o.totalBrut * 100)} bruts
                    (aujourd&apos;hui {formatNombre(Math.round(r.total))} h et {formatEuros(r.brut)}).
                  </li>
                  {o.tauxSiHeuresMin !== null && (
                    <li>
                      Autre option : faire seulement les {formatNombre(Math.ceil(o.heuresMin))} h qui manquent pour les{" "}
                      {formatNombre(Math.round(o.heuresMin + r.total))} h, mais payées{" "}
                      <span className="font-medium text-foreground">{euros(o.tauxSiHeuresMin)} brut de l&apos;heure</span>.
                    </li>
                  )}
                  {o.gainParJour !== null && o.gainParJour > 0 && (
                    <li>
                      Repère : chaque jour de {formatNombre(heuresJour)} h en plus ajoute environ {euros(o.gainParJour)} à ton
                      allocation journalière.
                    </li>
                  )}
                </ul>
              </>
            )}
          </section>
        )}

        <p className="flex items-start gap-2 text-xs text-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Calcul sur ta période {r.renouvellement ? "jusqu'à ta date anniversaire" : "des 12 derniers mois"}, contrats déjà signés
            compris, sans tenir compte des heures qui sortent de la période avec le temps. Allocation brute, avant prélèvements
            sociaux. {AVERTISSEMENT_REGLES}{" "}
            {!r.renouvellement && (
              <>
                Si tes droits sont ouverts, indique ta date anniversaire dans{" "}
                <Link href="/intermittence#situation" className="text-accent">Intermittence</Link> pour un calcul plus juste.
              </>
            )}
          </span>
        </p>
      </div>
    </>
  );
}
