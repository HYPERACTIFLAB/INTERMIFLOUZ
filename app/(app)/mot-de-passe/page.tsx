import { PageHeader } from "@/components/page-header";
import { MotDePasseForm } from "./form";

export const metadata = { title: "Mot de passe" };

export default function MotDePassePage() {
  return (
    <>
      <PageHeader title="Choisis ton mot de passe" description="Il remplace ton mot de passe actuel (ou le mot de passe provisoire)." />
      <div className="card p-4 md:p-6">
        <MotDePasseForm />
      </div>
    </>
  );
}
