"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import { formatPeriodeLongue } from "@/lib/format";
import { saveContrat, type FormState } from "./actions";
import { NOUVELLE_ORGANISATION, type ContratFormValues } from "./form-values";

const LIBELLES_TYPE: Record<string, string> = { contrat: "Contrat", fiche_paie: "Bulletin de salaire", aem: "AEM", autre: "Autre document" };
const LIBELLES_ANNEXE: Record<string, string> = { "8": "Annexe 8 (technicien)", "10": "Annexe 10 (artiste)", regime_general: "Régime général" };
const LIBELLES_AEM: Record<string, string> = { a_recevoir: "À recevoir", recue: "Reçue", transmise: "Transmise à France Travail" };

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
  /** Vérification d'un import : récapitulatif d'abord, champs sur demande. */
  apercu?: boolean;
  submitLabel: string;
};

const Legende = ({ children }: { children: React.ReactNode }) => (
  <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{children}</legend>
);

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
  apercu = false,
  submitLabel,
}: Props) {
  const [state, action] = useActionState<FormState, FormData>(saveContrat, {});
  const [organisationId, setOrganisationId] = useState(v.organisation_id);
  const [statutAem, setStatutAem] = useState(v.statut_aem);
  // Le récapitulatif ne suffit pas s'il manque l'essentiel ou si Claude a un doute.
  const incomplet = !v.date_debut || !v.date_fin || !v.organisation_id;
  const [edition, setEdition] = useState(!apercu || incomplet || incertains.length > 0);
  const doute = (nom: string) => incertains.includes(nom);
  const cls = (nom: string) => `input ${doute(nom) ? "input-incertain" : ""}`;
  const aide = (nom: string, texte?: string) =>
    doute(nom) && sources[nom] ? <>Lu dans le document : « {sources[nom]} »</> : texte;

  const societe =
    v.organisation_id === NOUVELLE_ORGANISATION ? v.organisation_nom : organisations.find((o) => o.id === v.organisation_id)?.nom;
  const recap: [string, string | undefined][] = [
    ["Projet", v.projet_nom],
    ["Société", societe ? `${societe}${v.organisation_id === NOUVELLE_ORGANISATION ? " (nouvelle)" : ""}` : undefined],
    ["Poste", v.poste],
    ["Dates", v.date_debut && v.date_fin ? formatPeriodeLongue(v.date_debut, v.date_fin) : undefined],
    ["Jours travaillés", joursTravailles.length ? String(joursTravailles.length) : undefined],
    ["Heures", v.heures ? `${v.heures} h` : undefined],
    ["Cachets", v.cachets && v.cachets !== "0" ? v.cachets : undefined],
    ["Salaire brut", v.salaire_brut ? `${v.salaire_brut} €` : undefined],
    ["Net à payer", v.salaire_net ? `${v.salaire_net} €` : undefined],
    ["Annexe", LIBELLES_ANNEXE[v.annexe]],
    ["AEM", LIBELLES_AEM[v.statut_aem]],
  ];

  return (
    <form action={action} className="space-y-6">
      <ErrorBanner message={state.error} />
      {contratId && <input type="hidden" name="id" value={contratId} />}
      {documents.length === 1 && <input type="hidden" name="document_ids" value={documents[0].id} />}
      {documents.length > 1 && (
        <fieldset className="rounded-xl bg-background p-4">
          <Legende>Documents regroupés sur cette fiche</Legende>
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

      {!edition && (
        <div>
          <dl className="divide-y divide-border rounded-xl border border-border">
            {recap
              .filter(([, valeur]) => valeur)
              .map(([label, valeur]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 text-right font-medium tabular-nums">{valeur}</dd>
                </div>
              ))}
          </dl>
          <button type="button" onClick={() => setEdition(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            <Pencil size={14} aria-hidden /> Corriger une information
          </button>
        </div>
      )}

      {/* Les champs restent dans le formulaire (cachés) pour être envoyés tels quels. */}
      <div className={edition ? "space-y-6" : "hidden"}>
        {apercu && incertains.length > 0 && (
          <p className="flex items-start gap-2 text-sm text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            Les champs en orange sont ceux où Claude n&apos;est pas sûr.
          </p>
        )}

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <Legende>Mission</Legende>
          <Field label="Projet" htmlFor="projet_nom" incertain={doute("projet_nom")} aide={aide("projet_nom", "Le nom du film, de la pub, du clip…")}>
            <input id="projet_nom" name="projet_nom" list="projets-existants" defaultValue={v.projet_nom} className={cls("projet_nom")} placeholder="Ex. Clip « Nuit blanche »" />
            <datalist id="projets-existants">
              {projets.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Poste" htmlFor="poste" incertain={doute("poste")} aide={aide("poste")}>
            <input id="poste" name="poste" defaultValue={v.poste} className={cls("poste")} placeholder="Ex. chef opérateur" />
          </Field>
          <Field label="Société de production" htmlFor="organisation_id" incertain={doute("organisation")} aide={aide("organisation")} className="sm:col-span-2">
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
            <div className="grid gap-4 rounded-xl bg-background p-4 sm:col-span-2 sm:grid-cols-2">
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
          <Legende>Dates et temps de travail</Legende>
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
            <p className="col-span-2 text-sm text-muted">{joursTravailles.length} jour(s) travaillé(s) détecté(s) dans le document.</p>
          )}
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-4">
          <Legende>Rémunération</Legende>
          <Field label="Salaire brut (€)" htmlFor="salaire_brut" incertain={doute("salaire_brut")} aide={aide("salaire_brut")}>
            <input id="salaire_brut" name="salaire_brut" inputMode="decimal" defaultValue={v.salaire_brut} className={cls("salaire_brut")} placeholder="0,00" />
          </Field>
          <Field label="Net à payer (€)" htmlFor="salaire_net" incertain={doute("salaire_net")} aide={aide("salaire_net")}>
            <input id="salaire_net" name="salaire_net" inputMode="decimal" defaultValue={v.salaire_net} className={cls("salaire_net")} placeholder="0,00" />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-4">
          <Legende>Attestation employeur (AEM)</Legende>
          <Field label="Statut" htmlFor="statut_aem">
            <select id="statut_aem" name="statut_aem" value={statutAem} onChange={(e) => setStatutAem(e.target.value as typeof statutAem)} className="input">
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
          <textarea id="notes" name="notes" rows={2} defaultValue={v.notes} className="input" />
        </Field>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[5] -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <SubmitButton className="btn-primary w-full md:w-auto">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
