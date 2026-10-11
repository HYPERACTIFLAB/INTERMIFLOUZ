"use client";

import { useActionState } from "react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import { saveObjectif, type ObjectifState } from "./actions";

type Props = {
  cible: number | null;
  taux: number | null;
  heuresJour: number | null;
  tauxMoyen: number | null;
  heuresJourMoyen: number | null;
};

const saisie = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export function ObjectifForm(p: Props) {
  const [state, action] = useActionState<ObjectifState, FormData>(saveObjectif, {});
  return (
    <form action={action} className="space-y-4">
      <ErrorBanner message={state.error} />
      <Field label="Allocation journalière visée (€ par jour)" htmlFor="objectif_aj">
        <input
          id="objectif_aj"
          name="objectif_aj"
          inputMode="decimal"
          defaultValue={saisie(p.cible)}
          placeholder="par exemple 90"
          className="input text-lg font-semibold"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Salaire brut par heure (€)"
          htmlFor="objectif_taux_horaire"
          aide={p.tauxMoyen !== null ? `Ta moyenne : ${saisie(p.tauxMoyen)} €/h` : "De tes prochains contrats."}
        >
          <input
            id="objectif_taux_horaire"
            name="objectif_taux_horaire"
            inputMode="decimal"
            defaultValue={saisie(p.taux)}
            placeholder={saisie(p.tauxMoyen) || "ex. 30"}
            className="input"
          />
        </Field>
        <Field
          label="Heures par jour"
          htmlFor="objectif_heures_jour"
          aide={p.heuresJourMoyen !== null ? `Ta moyenne : ${saisie(p.heuresJourMoyen)} h` : "Sur tes fiches de paie."}
        >
          <input
            id="objectif_heures_jour"
            name="objectif_heures_jour"
            inputMode="decimal"
            defaultValue={saisie(p.heuresJour)}
            placeholder={saisie(p.heuresJourMoyen) || "8"}
            className="input"
          />
        </Field>
      </div>
      <p className="text-xs text-muted">Laisse vide pour utiliser tes moyennes.</p>
      <SubmitButton pendingLabel="Calcul…">Calculer</SubmitButton>
      {state.ok && <span className="ml-3 text-sm text-accent">Enregistré.</span>}
    </form>
  );
}
