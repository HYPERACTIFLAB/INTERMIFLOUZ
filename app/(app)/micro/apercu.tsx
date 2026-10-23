import type { Client, Entreprise } from "@/lib/data/micro";
import { formatDate, formatEuros, formatNombre } from "@/lib/format";
import { montantLigne, type Ligne } from "@/lib/micro/calcul";

/** Aperçu à l'écran d'un devis ou d'une facture, mise en page proche du PDF. */
export function Apercu({
  type,
  numero,
  entreprise: e,
  client,
  objet,
  dateEmission,
  dateLimite,
  lignes,
  total,
  notes,
}: {
  type: "devis" | "facture";
  numero: string | null;
  entreprise: Entreprise;
  client: Client;
  objet: string | null;
  dateEmission: string | null;
  dateLimite: string | null;
  lignes: Ligne[];
  total: number;
  notes: string | null;
}) {
  return (
    <article className="rounded-2xl border border-border bg-white p-5 text-[13px] leading-relaxed text-neutral-900 shadow-sm md:p-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">{e.nom_commercial ?? e.nom ?? <span className="text-orange-600">Ton nom (Paramètres)</span>}</p>
          {e.nom_commercial && e.nom && <p>{e.nom}</p>}
          {e.activite && <p className="text-neutral-500">{e.activite}</p>}
          {e.adresse && <p className="whitespace-pre-line">{e.adresse}</p>}
          {e.siret ? <p>SIRET {e.siret}</p> : <p className="text-orange-600">SIRET manquant (Paramètres)</p>}
          {e.email && <p>{e.email}</p>}
          {e.telephone && <p>{e.telephone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold uppercase tracking-wide">{type === "devis" ? "Devis" : "Facture"}</p>
          <p className="font-medium">{numero ?? "Brouillon (numéro attribué à l'émission)"}</p>
          {dateEmission && <p>Date : {formatDate(dateEmission)}</p>}
          {dateLimite && <p>{type === "devis" ? "Valable jusqu'au" : "Échéance"} : {formatDate(dateLimite)}</p>}
        </div>
      </div>

      <div className="mt-6 ml-auto w-full max-w-xs rounded-lg bg-neutral-100 p-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{type === "devis" ? "Pour" : "Facturé à"}</p>
        {client ? (
          <>
            <p className="font-medium">{client.nom}</p>
            {client.adresse && <p className="whitespace-pre-line">{client.adresse}</p>}
            {client.siret && <p>SIRET {client.siret}</p>}
          </>
        ) : (
          <p className="text-orange-600">Client à choisir</p>
        )}
      </div>

      {objet && <p className="mt-6"><span className="font-medium">Objet :</span> {objet}</p>}

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2 font-medium">Désignation</th>
            <th className="py-2 text-right font-medium">Qté</th>
            <th className="hidden py-2 text-right font-medium sm:table-cell">Prix unit.</th>
            <th className="py-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-neutral-200 align-top">
              <td className="py-2 pr-2">{l.description}</td>
              <td className="py-2 text-right whitespace-nowrap tabular-nums">
                {formatNombre(l.quantite)} {l.unite}
              </td>
              <td className="hidden py-2 text-right tabular-nums sm:table-cell">{formatEuros(l.prix_unitaire)}</td>
              <td className="py-2 text-right tabular-nums">{formatEuros(montantLigne(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-full max-w-xs">
        <p className="flex justify-between border-t-2 border-neutral-900 pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatEuros(total)}</span>
        </p>
        <p className="mt-1 text-right text-xs text-neutral-500">{e.mention_tva}</p>
      </div>

      {notes && <p className="mt-6 whitespace-pre-line">{notes}</p>}

      <div className="mt-6 space-y-1 border-t border-neutral-200 pt-3 text-[11px] text-neutral-500">
        {type === "facture" ? (
          <>
            <p>{e.conditions_paiement}</p>
            {e.iban && <p>IBAN {e.iban}{e.bic ? ` · BIC ${e.bic}` : ""}</p>}
            <p>{e.penalites_retard}</p>
          </>
        ) : (
          <p>Devis à retourner signé avec la mention « Bon pour accord ».</p>
        )}
      </div>
    </article>
  );
}

export function valeursDepuisDocument(d: {
  id: string;
  organisation_id: string | null;
  projet: { nom: string } | null;
  objet: string | null;
  date_emission: string | null;
  lignes: Ligne[];
  notes: string | null;
}, dateLimite: string | null) {
  return {
    id: d.id,
    organisation_id: d.organisation_id ?? "",
    projet_nom: d.projet?.nom ?? "",
    objet: d.objet ?? "",
    date_emission: d.date_emission ?? new Date().toISOString().slice(0, 10),
    date_limite: dateLimite ?? "",
    lignes: d.lignes,
    notes: d.notes ?? "",
  };
}
