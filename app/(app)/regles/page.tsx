import { AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { SubmitButton } from "@/components/ui";
import { getDb } from "@/lib/data/db";
import { chargerRegles } from "@/lib/data/intermittence";
import { AVERTISSEMENT_REGLES, REGLES_PAR_DEFAUT, VERSION_REGLES, type CleRegle } from "@/lib/regles/regles";
import { formatDate, formatNombre } from "@/lib/format";
import { resetRegle, saveRegle } from "../intermittence/actions";

export const metadata = { title: "Règles de calcul" };

export default async function ReglesPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Règles de calcul"
      description={`Seuils et formules utilisés par l'appli, avec leur source (fichier du ${formatDate(VERSION_REGLES)}).`}
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;

  const regles = await chargerRegles(db.supabase);
  const cles = Object.keys(REGLES_PAR_DEFAUT) as CleRegle[];

  return (
    <>
      {header}
      <p className="mb-6 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">{AVERTISSEMENT_REGLES}</p>

      <ul className="space-y-3">
        {cles.map((cle) => {
          const r = regles[cle];
          const modifiee = regles._modifiees.includes(cle);
          return (
            <li key={cle} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{r.libelle}</p>
                  {r.description && <p className="mt-0.5 text-sm text-muted">{r.description}</p>}
                </div>
                {r.a_verifier ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                    <AlertTriangle size={12} aria-hidden /> à vérifier
                  </span>
                ) : modifiee ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">modifiée par toi</span>
                ) : null}
              </div>

              <form action={saveRegle} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="cle" value={cle} />
                <label htmlFor={`v-${cle}`} className="sr-only">Valeur</label>
                <input
                  id={`v-${cle}`}
                  name="valeur"
                  inputMode="decimal"
                  defaultValue={String(r.valeur).replace(".", ",")}
                  className="input w-32 tabular-nums"
                />
                <span className="text-sm text-muted">{r.unite}</span>
                <SubmitButton className="btn-secondary ml-auto text-sm" pendingLabel="…">
                  Enregistrer
                </SubmitButton>
              </form>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {modifiee ? (
                  <span>
                    Valeur du fichier : {formatNombre(REGLES_PAR_DEFAUT[cle].valeur)} {r.unite} · modifiée le {formatDate(r.verifie_le)}
                  </span>
                ) : (
                  <span>Vérifiée le {formatDate(r.verifie_le)}</span>
                )}
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent">
                  <ExternalLink size={12} aria-hidden /> {r.source}
                </a>
                {modifiee && (
                  <form action={resetRegle}>
                    <input type="hidden" name="cle" value={cle} />
                    <button className="inline-flex items-center gap-1 text-accent">
                      <RotateCcw size={12} aria-hidden /> Revenir à la valeur du fichier
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
