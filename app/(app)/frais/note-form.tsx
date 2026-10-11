"use client";

import { useActionState, useState } from "react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import { CATEGORIES_FRAIS, LIBELLES_CATEGORIE, type CategorieFrais } from "@/lib/extraction/justificatif";
import { saveNote, type FormState } from "./actions";

export type NoteValeurs = {
  date: string;
  marchand: string;
  description: string;
  montant_ttc: string;
  tva: string;
  categorie: CategorieFrais;
  moyen_paiement: string;
  refacturable_a: "employeur" | "client" | "aucun";
  organisation_id: string;
  contrat_id: string;
  projet_nom: string;
  statut: "a_rembourser" | "rembourse" | "non_remboursable";
  date_remboursement: string;
  notes: string;
};

export const NOTE_VIDE: NoteValeurs = {
  date: "",
  marchand: "",
  description: "",
  montant_ttc: "",
  tva: "",
  categorie: "autre",
  moyen_paiement: "",
  refacturable_a: "employeur",
  organisation_id: "",
  contrat_id: "",
  projet_nom: "",
  statut: "a_rembourser",
  date_remboursement: "",
  notes: "",
};

type Props = {
  valeurs: NoteValeurs;
  organisations: { id: string; nom: string }[];
  contrats: { id: string; libelle: string; organisation_id: string | null }[];
  projets: string[];
  noteId?: string;
  documentId?: string;
  incertains?: string[];
  submitLabel: string;
};

export function NoteForm({ valeurs: v, organisations, contrats, projets, noteId, documentId, incertains = [], submitLabel }: Props) {
  const [state, action] = useActionState<FormState, FormData>(saveNote, {});
  const [statut, setStatut] = useState(v.statut);
  const [contratId, setContratId] = useState(v.contrat_id);
  const [organisationId, setOrganisationId] = useState(v.organisation_id);
  const doute = (n: string) => incertains.includes(n);
  const cls = (n: string) => `input ${doute(n) ? "input-incertain" : ""}`;

  return (
    <form action={action} className="space-y-5">
      <ErrorBanner message={state.error} />
      {noteId && <input type="hidden" name="id" value={noteId} />}
      {documentId && <input type="hidden" name="document_id" value={documentId} />}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Montant TTC (€)" htmlFor="montant_ttc" incertain={doute("montant_ttc")}>
          <input id="montant_ttc" name="montant_ttc" inputMode="decimal" required defaultValue={v.montant_ttc} className={cls("montant_ttc")} placeholder="0,00" />
        </Field>
        <Field label="Date" htmlFor="date" incertain={doute("date")}>
          <input id="date" name="date" type="date" required defaultValue={v.date} className={cls("date")} />
        </Field>
        <Field label="Commerçant" htmlFor="marchand" incertain={doute("marchand")} className="col-span-2">
          <input id="marchand" name="marchand" defaultValue={v.marchand} className={cls("marchand")} placeholder="Ex. SNCF" />
        </Field>
        <Field label="Description" htmlFor="description" incertain={doute("description")} className="col-span-2">
          <input id="description" name="description" defaultValue={v.description} className={cls("description")} placeholder="Ex. Paris → Lyon, repérages" />
        </Field>
        <Field label="Catégorie" htmlFor="categorie" incertain={doute("categorie")}>
          <select id="categorie" name="categorie" defaultValue={v.categorie} className={cls("categorie")}>
            {CATEGORIES_FRAIS.map((c) => (
              <option key={c} value={c}>
                {LIBELLES_CATEGORIE[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="TVA (€)" htmlFor="tva" incertain={doute("tva")}>
          <input id="tva" name="tva" inputMode="decimal" defaultValue={v.tva} className={cls("tva")} placeholder="Facultatif" />
        </Field>
        <Field label="Paiement" htmlFor="moyen_paiement" incertain={doute("moyen_paiement")} className="col-span-2">
          <input id="moyen_paiement" name="moyen_paiement" defaultValue={v.moyen_paiement} className={cls("moyen_paiement")} placeholder="CB, espèces…" />
        </Field>
      </div>

      <fieldset className="space-y-4 border-t border-border pt-4">
        <legend className="sr-only">Rattachement</legend>
        <Field label="Contrat concerné" htmlFor="contrat_id" aide="Facultatif. L'employeur se remplit tout seul.">
          <select
            id="contrat_id"
            name="contrat_id"
            value={contratId}
            onChange={(e) => {
              setContratId(e.target.value);
              const c = contrats.find((x) => x.id === e.target.value);
              if (c?.organisation_id) setOrganisationId(c.organisation_id);
            }}
            className="input"
          >
            <option value="">— Aucun —</option>
            {contrats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="À refacturer à" htmlFor="refacturable_a">
            <select id="refacturable_a" name="refacturable_a" defaultValue={v.refacturable_a} className="input">
              <option value="employeur">Un employeur</option>
              <option value="client">Un client</option>
              <option value="aucun">Personne</option>
            </select>
          </Field>
          <Field label="Société" htmlFor="organisation_id">
            <select id="organisation_id" name="organisation_id" value={organisationId} onChange={(e) => setOrganisationId(e.target.value)} className="input">
              <option value="">—</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Projet" htmlFor="projet_nom">
          <input id="projet_nom" name="projet_nom" list="projets-frais" defaultValue={v.projet_nom} className="input" />
          <datalist id="projets-frais">
            {projets.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4 border-t border-border pt-4">
        <legend className="sr-only">Remboursement</legend>
        <Field label="Remboursement" htmlFor="statut">
          <select id="statut" name="statut" value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)} className="input">
            <option value="a_rembourser">À rembourser</option>
            <option value="rembourse">Remboursé</option>
            <option value="non_remboursable">Non remboursable</option>
          </select>
        </Field>
        {statut === "rembourse" && (
          <Field label="Remboursé le" htmlFor="date_remboursement">
            <input id="date_remboursement" name="date_remboursement" type="date" defaultValue={v.date_remboursement} className="input" />
          </Field>
        )}
        <Field label="Notes" htmlFor="notes" className="col-span-2">
          <textarea id="notes" name="notes" rows={2} defaultValue={v.notes} className="input" />
        </Field>
      </fieldset>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[5] -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <SubmitButton className="btn-primary w-full md:w-auto">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
