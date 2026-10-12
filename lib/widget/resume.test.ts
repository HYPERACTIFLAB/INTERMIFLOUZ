import { describe, expect, it } from "vitest";
import { resumeWidget, type DonneesWidget } from "./resume";

const contrat = (o: Partial<DonneesWidget["contrats"][number]>): DonneesWidget["contrats"][number] => ({
  id: Math.random().toString(),
  date_debut: "2026-09-01",
  date_fin: "2026-09-05",
  heures: "40.00",
  cachets: 0,
  salaire_brut: 120000,
  salaire_net: 93000,
  paye: true,
  statut_aem: "recue",
  jours_travailles: [],
  annexe: "8",
  projet: "PEACE TEA",
  employeur: "BIRTH",
  poste: "Régisseur",
  ...o,
});

describe("resumeWidget", () => {
  it("résume heures, ARE si 507 h, salaires et AEM", () => {
    const r = resumeWidget(
      {
        contrats: [
          contrat({}),
          contrat({ date_debut: "2026-10-01", date_fin: "2026-10-03", paye: false, statut_aem: "a_recevoir", salaire_net: 50000 }),
          contrat({ date_debut: "2026-11-02", date_fin: "2026-11-04", projet: "NIKE" }),
        ],
        situation: null,
        regles: [],
      },
      "2026-10-12",
    );
    expect(r.heures).toBe(80);
    expect(r.manquant).toBe(427);
    expect(r.are?.si507).toBe(true);
    expect(r.are!.montant).toBeGreaterThan(38);
    expect(r.a_percevoir).toBe(500);
    expect(r.aem_manquantes).toBe(1);
    expect(r.prochain).toMatchObject({ titre: "NIKE", en_cours: false });
  });
});
