import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/ui";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { formatEuros, formatPeriode } from "@/lib/format";
import { LIBELLES_TYPE_ORGANISATION, type Contact, type Contrat, type Organisation } from "@/lib/data/types";
import { deleteOrganisation } from "../actions";
import { ContactForm, OrganisationForm } from "../forms";
import { ContactItem } from "./contact-item";

export default async function OrganisationPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const [{ data: organisation }, { data: contacts }, { data: contrats }] = await Promise.all([
    db.supabase.from("organisations").select("*").eq("id", id).maybeSingle<Organisation>(),
    db.supabase.from("contacts").select("*").eq("organisation_id", id).order("nom").returns<Contact[]>(),
    db.supabase
      .from("contrats")
      .select("id, poste, date_debut, date_fin, salaire_brut")
      .eq("organisation_id", id)
      .order("date_debut", { ascending: false })
      .returns<Pick<Contrat, "id" | "poste" | "date_debut" | "date_fin" | "salaire_brut">[]>(),
  ]);
  if (!organisation) notFound();

  return (
    <>
      <PageHeader
        title={organisation.nom}
        description={LIBELLES_TYPE_ORGANISATION[organisation.type]}
        back={{ href: "/contacts", label: "Contacts" }}
      />

      <div className="space-y-8">
        <section aria-labelledby="interlocuteurs">
          <h2 id="interlocuteurs" className="mb-3 text-lg font-semibold">Interlocuteurs</h2>
          <div className="card divide-y divide-border">
            {(contacts ?? []).map((c) => (
              <ContactItem key={c.id} contact={c} />
            ))}
            <details className="p-4" open={(contacts ?? []).length === 0}>
              <summary className="cursor-pointer font-medium text-accent">Ajouter un interlocuteur</summary>
              <div className="mt-4">
                <ContactForm organisationId={organisation.id} />
              </div>
            </details>
          </div>
        </section>

        {(contrats ?? []).length > 0 && (
          <section aria-labelledby="contrats-lies">
            <h2 id="contrats-lies" className="mb-3 text-lg font-semibold">Contrats</h2>
            <ul className="card divide-y divide-border">
              {contrats!.map((c) => (
                <li key={c.id}>
                  <Link href={`/contrats/${c.id}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-background">
                    <span>
                      <span className="block font-medium">{c.poste ?? "Contrat"}</span>
                      <span className="block text-sm text-muted">{formatPeriode(c.date_debut, c.date_fin)}</span>
                    </span>
                    <span className="text-sm tabular-nums">{formatEuros(c.salaire_brut)} brut</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="infos">
          <h2 id="infos" className="mb-3 text-lg font-semibold">Informations</h2>
          <div className="card p-4 md:p-6">
            <OrganisationForm organisation={organisation} />
          </div>
        </section>

        <form action={deleteOrganisation}>
          <input type="hidden" name="id" value={organisation.id} />
          <ConfirmButton message={`Supprimer ${organisation.nom} ? Ses interlocuteurs seront aussi supprimés. Les contrats sont conservés, sans employeur.`}>
            Supprimer la société
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
