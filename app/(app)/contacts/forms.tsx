"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import type { Contact, Organisation } from "@/lib/data/types";
import { saveContact, saveOrganisation, type FormState } from "./actions";

export function OrganisationForm({ organisation }: { organisation?: Organisation }) {
  const [state, action] = useActionState<FormState, FormData>(saveOrganisation, {});
  const o = organisation;
  return (
    <form action={action} className="space-y-4">
      <ErrorBanner message={state.error} />
      {state.ok && <p className="text-sm text-accent">Enregistré.</p>}
      {o && <input type="hidden" name="id" value={o.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="nom" className="sm:col-span-2">
          <input id="nom" name="nom" required defaultValue={o?.nom} className="input" placeholder="Ex. Les Films du Lendemain" />
        </Field>
        <Field label="Type" htmlFor="type">
          <select id="type" name="type" defaultValue={o?.type ?? "employeur"} className="input">
            <option value="employeur">Employeur (intermittence)</option>
            <option value="client">Client (micro-entreprise)</option>
            <option value="les_deux">Les deux</option>
          </select>
        </Field>
        <Field label="SIRET" htmlFor="siret">
          <input id="siret" name="siret" inputMode="numeric" defaultValue={o?.siret ?? ""} className="input" />
        </Field>
        <Field label="N° d'objet" htmlFor="numero_objet" aide="Numéro d'objet Congés Spectacles / France Travail, s'il y en a un.">
          <input id="numero_objet" name="numero_objet" defaultValue={o?.numero_objet ?? ""} className="input" />
        </Field>
        <Field label="Téléphone" htmlFor="telephone">
          <input id="telephone" name="telephone" type="tel" defaultValue={o?.telephone ?? ""} className="input" />
        </Field>
        <Field label="E-mail" htmlFor="email" className="sm:col-span-2">
          <input id="email" name="email" type="email" defaultValue={o?.email ?? ""} className="input" />
        </Field>
        <Field label="Adresse" htmlFor="adresse" className="sm:col-span-2">
          <textarea id="adresse" name="adresse" rows={2} defaultValue={o?.adresse ?? ""} className="input" />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <textarea id="notes" name="notes" rows={2} defaultValue={o?.notes ?? ""} className="input" />
        </Field>
      </div>
      <SubmitButton>{o ? "Enregistrer" : "Créer la société"}</SubmitButton>
    </form>
  );
}

export function ContactForm({
  organisationId,
  contact,
  onDone,
}: {
  organisationId: string;
  contact?: Contact;
  onDone?: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveContact, {});
  const formRef = useRef<HTMLFormElement>(null);
  const c = contact;

  useEffect(() => {
    if (state.ok) {
      if (!c) formRef.current?.reset();
      onDone?.();
    }
  }, [state, c, onDone]);

  const p = c?.id ?? "nouveau";
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <ErrorBanner message={state.error} />
      {c && <input type="hidden" name="id" value={c.id} />}
      <input type="hidden" name="organisation_id" value={organisationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom" htmlFor={`prenom-${p}`}>
          <input id={`prenom-${p}`} name="prenom" defaultValue={c?.prenom ?? ""} className="input" />
        </Field>
        <Field label="Nom" htmlFor={`nom-${p}`}>
          <input id={`nom-${p}`} name="nom" defaultValue={c?.nom ?? ""} className="input" />
        </Field>
        <Field label="Fonction" htmlFor={`fonction-${p}`} className="sm:col-span-2">
          <input id={`fonction-${p}`} name="fonction" defaultValue={c?.fonction ?? ""} className="input" placeholder="Ex. directrice de production" />
        </Field>
        <Field label="E-mail" htmlFor={`email-${p}`}>
          <input id={`email-${p}`} name="email" type="email" defaultValue={c?.email ?? ""} className="input" />
        </Field>
        <Field label="Téléphone" htmlFor={`tel-${p}`}>
          <input id={`tel-${p}`} name="telephone" type="tel" defaultValue={c?.telephone ?? ""} className="input" />
        </Field>
      </div>
      <SubmitButton>{c ? "Enregistrer" : "Ajouter l'interlocuteur"}</SubmitButton>
    </form>
  );
}
