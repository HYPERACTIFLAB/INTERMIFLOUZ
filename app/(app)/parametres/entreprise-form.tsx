"use client";

import { useActionState } from "react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import type { Entreprise } from "@/lib/data/micro";
import { saveEntreprise, type EtatParametres } from "./actions";

const Legende = ({ children }: { children: React.ReactNode }) => (
  <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{children}</legend>
);

export function EntrepriseForm({ e }: { e: Entreprise }) {
  const [etat, action] = useActionState<EtatParametres, FormData>(saveEntreprise, {});
  return (
    <form action={action} className="space-y-6">
      <ErrorBanner message={etat.error} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <Legende>Identité</Legende>
        <Field label="Nom et prénom" htmlFor="nom" aide="Tel qu'inscrit au répertoire SIRENE.">
          <input id="nom" name="nom" defaultValue={e.nom ?? ""} className="input" autoComplete="name" />
        </Field>
        <Field label="Nom commercial" htmlFor="nom_commercial" aide="Facultatif.">
          <input id="nom_commercial" name="nom_commercial" defaultValue={e.nom_commercial ?? ""} className="input" />
        </Field>
        <Field label="SIRET" htmlFor="siret">
          <input id="siret" name="siret" inputMode="numeric" defaultValue={e.siret ?? ""} className="input" />
        </Field>
        <Field label="Activité" htmlFor="activite" aide="Affichée sous ton nom, ex. « Photographe ».">
          <input id="activite" name="activite" defaultValue={e.activite ?? ""} className="input" />
        </Field>
        <Field label="Début d'activité" htmlFor="date_debut_activite" aide="Sert à calculer tes échéances URSSAF.">
          <input id="date_debut_activite" name="date_debut_activite" type="date" defaultValue={e.date_debut_activite ?? ""} className="input" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <Legende>Coordonnées</Legende>
        <Field label="Adresse" htmlFor="adresse" className="sm:col-span-2">
          <textarea id="adresse" name="adresse" rows={2} defaultValue={e.adresse ?? ""} className="input" autoComplete="street-address" />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <input id="email" name="email" type="email" defaultValue={e.email ?? ""} className="input" autoComplete="email" />
        </Field>
        <Field label="Téléphone" htmlFor="telephone">
          <input id="telephone" name="telephone" type="tel" defaultValue={e.telephone ?? ""} className="input" autoComplete="tel" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <Legende>Paiement</Legende>
        <Field label="IBAN" htmlFor="iban" aide="Affiché sur tes factures pour le virement.">
          <input id="iban" name="iban" defaultValue={e.iban ?? ""} className="input font-mono" autoComplete="off" />
        </Field>
        <Field label="BIC" htmlFor="bic">
          <input id="bic" name="bic" defaultValue={e.bic ?? ""} className="input font-mono" autoComplete="off" />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <Legende>Mentions sur les factures</Legende>
        <Field label="TVA" htmlFor="mention_tva">
          <input id="mention_tva" name="mention_tva" defaultValue={e.mention_tva} className="input" />
        </Field>
        <Field label="Conditions de paiement" htmlFor="conditions_paiement">
          <input id="conditions_paiement" name="conditions_paiement" defaultValue={e.conditions_paiement} className="input" />
        </Field>
        <Field label="Pénalités de retard" htmlFor="penalites_retard">
          <textarea id="penalites_retard" name="penalites_retard" rows={3} defaultValue={e.penalites_retard} className="input" />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton>Enregistrer</SubmitButton>
        {etat.ok && <span className="text-sm text-accent">Enregistré.</span>}
      </div>
    </form>
  );
}
