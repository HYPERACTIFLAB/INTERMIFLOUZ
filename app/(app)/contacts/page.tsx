import Link from "next/link";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DemoNotice, EmptyState } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { LIBELLES_TYPE_ORGANISATION, type Organisation } from "@/lib/data/types";

export const metadata = { title: "Contacts" };

export default async function ContactsPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Contacts"
      description="Sociétés de production, clients et interlocuteurs"
      actions={
        <Link href="/contacts/nouveau" className="btn-primary">
          <Plus size={18} aria-hidden /> Nouvelle société
        </Link>
      }
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;

  const { data } = await db.supabase
    .from("organisations")
    .select("id, nom, type, contacts(count), contrats(count)")
    .order("nom");
  const organisations = (data ?? []) as (Pick<Organisation, "id" | "nom" | "type"> & {
    contacts: { count: number }[];
    contrats: { count: number }[];
  })[];

  return (
    <>
      {header}
      {organisations.length === 0 ? (
        <EmptyState icon={Building2} title="Aucune société pour l'instant">
          Elles se créent aussi automatiquement quand tu importes un contrat.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {organisations.map((o) => (
            <li key={o.id}>
              <Link href={`/contacts/${o.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-background">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.nom}</span>
                  <span className="block text-sm text-muted">
                    {LIBELLES_TYPE_ORGANISATION[o.type]} · {o.contacts[0]?.count ?? 0} interlocuteur(s) ·{" "}
                    {o.contrats[0]?.count ?? 0} contrat(s)
                  </span>
                </span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
