import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { demoMode } from "@/lib/config";
import { OrganisationForm } from "../forms";

export const metadata = { title: "Nouvelle société" };

export default function NouvelleOrganisationPage() {
  return (
    <>
      <PageHeader title="Nouvelle société" back={{ href: "/contacts", label: "Contacts" }} />
      {demoMode ? <DemoNotice /> : <div className="card p-4 md:p-6"><OrganisationForm /></div>}
    </>
  );
}
