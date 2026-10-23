import { PageHeader } from "@/components/page-header";
import { aujourdhui } from "@/lib/regles/dates";
import { RecetteForm } from "./recette-form";

export const metadata = { title: "Recette sans facture" };

export default function NouvelleRecettePage() {
  return (
    <>
      <PageHeader
        title="Recette sans facture"
        description="Une vente payée sans facture (ex. à un particulier) compte aussi dans ton chiffre d'affaires."
        back={{ href: "/micro/encaissements", label: "Encaissements" }}
      />
      <div className="card p-4 md:p-6">
        <RecetteForm jour={aujourdhui()} />
      </div>
    </>
  );
}
