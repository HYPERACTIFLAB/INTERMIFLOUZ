"use client";

import { useActionState, useState } from "react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import { saveSituation, type FormState } from "./actions";

type Props = {
  droitsOuverts: boolean;
  dateOuverture: string | null;
  dateAnniversaire: string | null;
  ajActuelle: number | null;
};

export function SituationForm(p: Props) {
  const [state, action] = useActionState<FormState, FormData>(saveSituation, {});
  const [droits, setDroits] = useState(p.droitsOuverts);
  return (
    <form action={action} className="space-y-4">
      <ErrorBanner message={state.error} />
      {state.ok && <p className="text-sm text-accent">Enregistré.</p>}
      <fieldset>
        <legend className="label">As-tu des droits ouverts à l&apos;intermittence ?</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: true, l: "Oui" },
            { v: false, l: "Pas encore" },
          ].map((o) => (
            <label
              key={o.l}
              className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium ${
                droits === o.v ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name="droits_ouverts"
                value={o.v ? "oui" : "non"}
                checked={droits === o.v}
                onChange={() => setDroits(o.v)}
                className="sr-only"
              />
              {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      {droits && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date anniversaire" htmlFor="date_anniversaire" aide="Sur ta notification de droits.">
            <input id="date_anniversaire" name="date_anniversaire" type="date" defaultValue={p.dateAnniversaire ?? ""} className="input" required />
          </Field>
          <Field label="Ouverture des droits" htmlFor="date_ouverture" aide="Facultatif.">
            <input id="date_ouverture" name="date_ouverture" type="date" defaultValue={p.dateOuverture ?? ""} className="input" />
          </Field>
          <Field label="Allocation journalière actuelle (€)" htmlFor="aj_actuelle" aide="Facultatif, pour comparer." className="col-span-2">
            <input id="aj_actuelle" name="aj_actuelle" inputMode="decimal" defaultValue={p.ajActuelle ?? ""} className="input" />
          </Field>
        </div>
      )}
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}
