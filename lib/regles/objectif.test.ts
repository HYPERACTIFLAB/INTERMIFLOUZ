import { describe, expect, it } from "vitest";
import { appliquerModifications } from "./regles";
import { allocationJournaliere } from "./intermittence";
import { moyennesContrats, objectifAllocation } from "./objectif";

const regles = appliquerModifications([]);
const base = { heures: 300, brut: 9000, tauxHoraire: 30, heuresParJour: 8 };

describe("objectifAllocation", () => {
  it("trouve le nombre d'heures qui donne l'allocation visée", () => {
    const r = objectifAllocation({ ...base, cible: 90 }, regles);
    expect(r.statut).toBe("a_faire");
    if (r.statut !== "a_faire") return;
    expect(r.heures).toBeGreaterThanOrEqual(207);
    expect(allocationJournaliere(r.totalBrut, r.totalHeures, regles).finale).toBeGreaterThanOrEqual(90);
    // Une heure de moins ne suffit pas.
    expect(allocationJournaliere(9000 + (r.heures - 1) * 30, 300 + r.heures - 1, regles).finale).toBeLessThan(90);
    expect(r.jours).toBe(Math.ceil(r.heures / 8));
  });
  it("exige au moins les heures manquantes pour les 507 h", () => {
    const r = objectifAllocation({ ...base, cible: 39 }, regles);
    expect(r.statut).toBe("a_faire");
    if (r.statut === "a_faire") expect(r.heures).toBe(207);
  });
  it("dit quand c'est déjà atteint", () => {
    expect(objectifAllocation({ ...base, heures: 600, brut: 20000, cible: 60 }, regles).statut).toBe("atteint");
  });
  it("refuse une cible au-dessus du plafond", () => {
    expect(objectifAllocation({ ...base, cible: 500 }, regles).statut).toBe("au_dessus_plafond");
  });
  it("calcule le taux horaire nécessaire si on ne fait que les heures manquantes", () => {
    const r = objectifAllocation({ ...base, cible: 90 }, regles);
    if (r.statut !== "a_faire") throw new Error();
    expect(r.tauxSiHeuresMin).toBeGreaterThan(30);
    expect(allocationJournaliere(9000 + r.tauxSiHeuresMin! * 207, 507, regles).finale).toBeGreaterThanOrEqual(90);
  });
});

describe("moyennesContrats", () => {
  it("calcule le taux horaire et les heures par jour", () => {
    const m = moyennesContrats([
      { id: "1", date_debut: "2026-01-01", date_fin: "2026-01-02", heures: 20, cachets: 0, salaire_brut: 60000, jours_travailles: ["2026-01-01", "2026-01-02"] },
      { id: "2", date_debut: "2026-02-01", date_fin: "2026-02-01", heures: 10, cachets: 0, salaire_brut: null },
    ]);
    expect(m).toEqual({ tauxHoraire: 30, heuresParJour: 10 });
  });
});
