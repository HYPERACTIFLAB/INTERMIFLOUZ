"use client";

import { useActionState, useState } from "react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import { saveContrat, type FormState } from "./actions";
import { NOUVELLE_ORGANISATION, type ContratFormValues } from "./form-values";

const LIBELLES_TYPE: Record<string, string> = { contrat: "Contrat", fiche_paie: "Bulletin de salaire", aem: "AEM", autre: "Autre document" };

type Props = {
  valeurs: ContratFormValues;
  organisations: { id: string; nom: string }[];
  projets: string[];
  contratId?: string;
  /** Documents importés rattachés à la fiche (cases à cocher s'il y en a plusieurs). */
  documents?: { id: string; nom_fichier: string; type: string }[];
  source?: "manuel" | "import_ia";
  joursTravailles?: string[];
  /** Champs que Claude n'a pas lus avec certitude (surlignés en orange). */
  incertains?: string[];
  /** Extraits du document, affichés sous les champs incertains. */
  sources?: Record<string, string>;
  submitLabel: string;
};

export function ContratForm({
  valeurs: v,
  organisations,
  projets,
  contratId,
  documents = [],
  source = "manuel",
  joursTravailles = [],
  incertains = [],
  sources = {},
  submitLabel,
}: Props) {
  const [state, action] = useActionState<FormState, FormData>(saveContrat, {});
  const [organisationId, setOrganisationId] = useState(v.organisation_id);
  const [statutAem, setStatutAem] = useState(v.statut_aem);
  const doute = (nom: string) => incertains.includes(nom);
  const cls = (nom: string) => `input ${doute(nom) ? "input-incertain" : ""}`;
  const aide = (nom: string, texte?: string) =>
    doute(nom) && sources[nom] ? (
      <>Lu dans le document : « {sources[nom]} »</>
    ) : (
      texte
    );

  return (
    <form action={action} className="space-y-6">
      <ErrorBanner message={state.error} />
      {contratId && <input type="hidden" name="id" value={contratId} />}
      {documents.length === 1 && <input type="hidden" name="document_ids" value={documents[0].id} />}
      {documents.length > 1 && (
        <fieldset className="rounded-xl bg-background p-4">
          <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Documents regroupés sur cette fiche
          </legend>
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id}>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="document_ids" value={d.id} defaultChecked className="mt-0.5 size-5 accent-[var(--accent)]" />
                  <span className="min-w-0">
                    <span className="block font-medium">{LIBELLES_TYPE[d.type] ?? "Document"}</span>
                    <span className="block truncate text-muted">{d.nom_fichier}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Décoche un document s&apos;il ne concerne pas ce contrat : il restera à vérifier à part.</p>
        </fieldset>
      )}
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="jours_travailles" value={JSON.stringify(joursTravailles)} />

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Employeur</legend>
        <Field label="Société" htmlFor="organisation_id" incertain={doute("organisation")} aide={aide("organisation")}>
          <select
            id="organisation_id"
            name="organisation_id"
            value={organisationId}
            onChange={(e) => setOrganisationId(e.target.value)}
            className={cls("organisation")}
          >
            <option value="">— Choisir —</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
              </option>
            ))}
            <option value={NOUVELLE_ORGANISATION}>+ Nouvelle société…</option>
          </select>
        </Field>

        {organisationId === NOUVELLE_ORGANISATION && (
          <div className="grid gap-4 rounded-xl bg-background p-4 sm:grid-cols-2">
            <Field label="Nom de la société" htmlFor="organisation_nom" className="sm:col-span-2" incertain={doute("organisation")}>
              <input id="organisation_nom" name="organisation_nom" defaultValue={v.organisation_nom} className={cls("organisation")} />
            </Field>
            <Field label="SIRET" htmlFor="organisation_siret" incertain={doute("organisation_siret")} aide={aide("organisation_siret")}>
              <input id="organisation_siret" name="organisation_siret" inputMode="numeric" defaultValue={v.organisation_siret} className={cls("organisation_siret")} />
            </Field>
            <Field label="N° d'objet" htmlFor="organisation_numero_objet" incertain={doute("organisation_numero_objet")} aide={aide("organisation_numero_objet")}>
              <input id="organisation_numero_objet" name="organisation_numero_objet" defaultValue={v.organisation_numero_objet} className={cls("organisation_numero_objet")} />
            </Field>
            <Field label="Adresse" htmlFor="organisation_adresse" className="sm:col-span-2" incertain={doute("organisation_adresse")}>
              <textarea id="organisation_adresse" name="organisation_adresse" rows={2} defaultValue={v.organisation_adresse} className={cls("organisation_adresse")} />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Mission</legend>
        <Field label="Poste" htmlFor="poste" incertain={doute("poste")} aide={aide("poste")}>
          <input id="poste" name="poste" defaultValue={v.poste} className={cls("poste")} placeholder="Ex. chef opérateur" />
        </Field>
        <Field label="Projet" htmlFor="projet_nom" incertain={doute("projet_nom")} aide={aide("projet_nom")}>
          <input id="projet_nom" name="projet_nom" list="projets-existants" defaultValue={v.projet_nom} className={cls("projet_nom")} placeholder="Ex. Clip « Nuit blanche »" />
          <datalist id="projets-existants">
            {projets.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Annexe" htmlFor="annexe" incertain={doute("annexe")} aide={aide("annexe")}>
          <select id="annexe" name="annexe" defaultValue={v.annexe} className={cls("annexe")}>
            <option value="8">Annexe 8 (technicien)</option>
            <option value="10">Annexe 10 (artiste)</option>
            <option value="regime_general">Régime général</option>
          </select>
        </Field>
        <Field label="Type de contrat" htmlFor="type_contrat">
          <select id="type_contrat" name="type_contrat" defaultValue={v.type_contrat} className="input">
            <option value="cddu">CDDU</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Dates et temps de travail</legend>
        <Field label="Début" htmlFor="date_debut" incertain={doute("date_debut")} aide={aide("date_debut")}>
          <input id="date_debut" name="date_debut" type="date" required defaultValue={v.date_debut} className={cls("date_debut")} />
        </Field>
        <Field label="Fin" htmlFor="date_fin" incertain={doute("date_fin")} aide={aide("date_fin")}>
          <input id="date_fin" name="date_fin" type="date" required defaultValue={v.date_fin} className={cls("date_fin")} />
        </Field>
        <Field label="Heures" htmlFor="heures" incertain={doute("heures")} aide={aide("heures")}>
          <input id="heures" name="heures" inputMode="decimal" defaultValue={v.heures} className={cls("heures")} placeholder="0" />
        </Field>
        <Field label="Cachets" htmlFor="cachets" incertain={doute("cachets")} aide={aide("cachets", "Laisse vide si payé à l'heure.")}>
          <input id="cachets" name="cachets" inputMode="numeric" defaultValue={v.cachets} className={cls("cachets")} placeholder="0" />
        </Field>
        {joursTravailles.length > 0 && (
          <p className="col-span-2 text-sm text-muted">
            {joursTravailles.length} jour(s) travaillé(s) détecté(s) dans le document.
          </p>
        )}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Rémunération</legend>
        <Field label="Salaire brut (€)" htmlFor="salaire_brut" incertain={doute("salaire_brut")} aide={aide("salaire_brut")}>
          <input id="salaire_brut" name="salaire_brut" inputMode="decimal" defaultValue={v.salaire_brut} className={cls("salaire_brut")} placeholder="0,00" />
        </Field>
        <Field label="Salaire net (€)" htmlFor="salaire_net" incertain={doute("salaire_net")} aide={aide("salaire_net")}>
          <input id="salaire_net" name="salaire_net" inputMode="decimal" defaultValue={v.salaire_net} className={cls("salaire_net")} placeholder="0,00" />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Attestation employeur (AEM)</legend>
        <Field label="Statut" htmlFor="statut_aem">
          <select
            id="statut_aem"
            name="statut_aem"
            value={statutAem}
            onChange={(e) => setStatutAem(e.target.value as typeof statutAem)}
            className="input"
          >
            <option value="a_recevoir">À recevoir</option>
            <option value="recue">Reçue</option>
            <option value="transmise">Transmise à France Travail</option>
          </select>
        </Field>
        {statutAem !== "a_recevoir" && (
          <Field label="Reçue le" htmlFor="date_reception_aem">
            <input id="date_reception_aem" name="date_reception_aem" type="date" defaultValue={v.date_reception_aem} className="input" />
          </Field>
        )}
      </fieldset>

      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} defaultValue={v.notes} className="input" />
      </Field>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[5] -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <SubmitButton className="btn-primary w-full md:w-auto">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
