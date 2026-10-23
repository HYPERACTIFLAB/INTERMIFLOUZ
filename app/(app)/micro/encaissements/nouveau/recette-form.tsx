"use client";

import { useActionState } from "react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import { ajouterRecette, type EtatDocument } from "../../actions";

export function RecetteForm({ jour }: { jour: string }) {
  const [etat, action] = useActionState<EtatDocument, FormData>(ajouterRecette, {});
  return (
    <form action={action} className="space-y-4">
      <ErrorBanner message={etat.error} />
      <Field label="Quoi et pour qui" htmlFor="libelle">
        <input id="libelle" name="libelle" className="input" placeholder="Ex. Tirage photo vendu à un particulier" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Montant reçu (€)" htmlFor="montant">
          <input id="montant" name="montant" inputMode="decimal" className="input" required />
        </Field>
        <Field label="Date de réception" htmlFor="date">
          <input id="date" name="date" type="date" defaultValue={jour} className="input" required />
        </Field>
      </div>
      <Field label="Moyen de paiement" htmlFor="moyen">
        <select id="moyen" name="moyen" className="input">
          <option>virement</option>
          <option>espèces</option>
          <option>chèque</option>
          <option>carte</option>
          <option>autre</option>
        </select>
      </Field>
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}
