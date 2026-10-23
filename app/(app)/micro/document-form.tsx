"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import { formatEuros } from "@/lib/format";
import { saveDevis, saveFacture, type EtatDocument } from "./actions";
import { NOUVEAU_CLIENT } from "./constantes";

/** Ligne telle que saisie (prix en euros, texte libre). */
type LigneSaisie = { description: string; quantite: string; unite: string; prix: string };

export type ValeursDocument = {
  id?: string;
  organisation_id: string;
  projet_nom: string;
  objet: string;
  date_emission: string;
  /** Date de validité (devis) ou d'échéance (facture). */
  date_limite: string;
  lignes: { description: string; quantite: number; unite: string; prix_unitaire: number }[];
  notes: string;
};

const nombre = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));
const centimes = (s: string) => Math.round(nombre(s) * 100);
const versSaisie = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const LIGNE_VIDE: LigneSaisie = { description: "", quantite: "1", unite: "jour", prix: "" };

export function DocumentForm({
  type,
  valeurs: v,
  clients,
  projets,
}: {
  type: "devis" | "facture";
  valeurs: ValeursDocument;
  clients: { id: string; nom: string }[];
  projets: string[];
}) {
  const [etat, action] = useActionState<EtatDocument, FormData>(type === "devis" ? saveDevis : saveFacture, {});
  const [client, setClient] = useState(v.organisation_id || (clients.length ? "" : NOUVEAU_CLIENT));
  const [lignes, setLignes] = useState<LigneSaisie[]>(
    v.lignes.length
      ? v.lignes.map((l) => ({ description: l.description, quantite: String(l.quantite).replace(".", ","), unite: l.unite, prix: versSaisie(l.prix_unitaire) }))
      : [LIGNE_VIDE],
  );
  const maj = (i: number, champ: keyof LigneSaisie, valeur: string) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [champ]: valeur } : l)));

  const pourEnvoi = lignes
    .filter((l) => l.description.trim() || l.prix.trim())
    .map((l) => ({ description: l.description.trim(), quantite: nombre(l.quantite || "1"), unite: l.unite.trim(), prix_unitaire: centimes(l.prix || "0") }));
  const total = pourEnvoi.reduce((s, l) => s + (Number.isFinite(l.quantite * l.prix_unitaire) ? Math.round(l.quantite * l.prix_unitaire) : 0), 0);

  return (
    <form action={action} className="space-y-6">
      <ErrorBanner message={etat.error} />
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <input type="hidden" name="lignes" value={JSON.stringify(pourEnvoi)} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Client</legend>
        <Field label="Client" htmlFor="organisation_id" className="sm:col-span-2">
          <select id="organisation_id" name="organisation_id" value={client} onChange={(e) => setClient(e.target.value)} className="input">
            <option value="">— Choisir —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
            <option value={NOUVEAU_CLIENT}>+ Nouveau client…</option>
          </select>
        </Field>
        {client === NOUVEAU_CLIENT && (
          <div className="grid gap-4 rounded-xl bg-background p-4 sm:col-span-2 sm:grid-cols-2">
            <Field label="Nom ou raison sociale" htmlFor="client_nom" className="sm:col-span-2">
              <input id="client_nom" name="client_nom" className="input" required />
            </Field>
            <Field label="Adresse" htmlFor="client_adresse" className="sm:col-span-2">
              <textarea id="client_adresse" name="client_adresse" rows={2} className="input" />
            </Field>
            <Field label="SIRET" htmlFor="client_siret" aide="Pour une entreprise.">
              <input id="client_siret" name="client_siret" inputMode="numeric" className="input" />
            </Field>
            <Field label="E-mail" htmlFor="client_email">
              <input id="client_email" name="client_email" type="email" className="input" />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{type === "devis" ? "Devis" : "Facture"}</legend>
        <Field label="Objet" htmlFor="objet" className="sm:col-span-2">
          <input id="objet" name="objet" defaultValue={v.objet} className="input" placeholder="Ex. Reportage photo du lancement" />
        </Field>
        <Field label="Projet" htmlFor="projet_nom" aide="Facultatif.">
          <input id="projet_nom" name="projet_nom" list="projets-micro" defaultValue={v.projet_nom} className="input" />
          <datalist id="projets-micro">
            {projets.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" htmlFor="date_emission">
            <input id="date_emission" name="date_emission" type="date" required defaultValue={v.date_emission} className="input" />
          </Field>
          <Field
            label={type === "devis" ? "Valable jusqu'au" : "Échéance"}
            htmlFor={type === "devis" ? "date_validite" : "date_echeance"}
            aide={type === "facture" ? "Vide : 30 jours." : undefined}
          >
            <input
              id={type === "devis" ? "date_validite" : "date_echeance"}
              name={type === "devis" ? "date_validite" : "date_echeance"}
              type="date"
              defaultValue={v.date_limite}
              className="input"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Prestations</legend>
        <ul className="space-y-3">
          {lignes.map((l, i) => (
            <li key={i} className="rounded-xl border border-border p-3">
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`desc-${i}`}>Description</label>
                <input
                  id={`desc-${i}`}
                  value={l.description}
                  onChange={(e) => maj(i, "description", e.target.value)}
                  className="input flex-1"
                  placeholder="Ex. Journée de prise de vue"
                />
                {lignes.length > 1 && (
                  <button type="button" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} className="p-2 text-muted hover:text-danger" aria-label="Supprimer la ligne">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-muted">
                  Quantité
                  <input value={l.quantite} onChange={(e) => maj(i, "quantite", e.target.value)} inputMode="decimal" className="input mt-1" />
                </label>
                <label className="text-xs text-muted">
                  Unité
                  <input value={l.unite} onChange={(e) => maj(i, "unite", e.target.value)} className="input mt-1" placeholder="jour, h, photo…" />
                </label>
                <label className="text-xs text-muted">
                  Prix unitaire (€)
                  <input value={l.prix} onChange={(e) => maj(i, "prix", e.target.value)} inputMode="decimal" className="input mt-1" placeholder="0,00" />
                </label>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setLignes((ls) => [...ls, LIGNE_VIDE])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          <Plus size={16} aria-hidden /> Ajouter une ligne
        </button>
        <p className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-muted">Total (TVA non applicable)</span>
          <span className="text-xl font-semibold tabular-nums">{formatEuros(total)}</span>
        </p>
      </fieldset>

      <Field label="Notes" htmlFor="notes" aide="Affichées en bas du document.">
        <textarea id="notes" name="notes" rows={2} defaultValue={v.notes} className="input" />
      </Field>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[5] -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <SubmitButton className="btn-primary w-full md:w-auto">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
