import { describe, expect, it } from "vitest";
import { appliquerModifications } from "./regles";
import { allocationJournaliere, compteur, cumulPeriode, partDansPeriode, recapMois, type ContratCalcul } from "./intermittence";

const regles = appliquerModifications([]);
const c = (o: Partial<ContratCalcul>): ContratCalcul => ({
  id: Math.random().toString(),
  date_debut: "2026-07-16",
  date_fin: "2026-07-18",
  heures: 24,
  cachets: 0,
  salaire_brut: 54000,
  annexe: "8",
  ...o,
});

describe("partDansPeriode", () => {
  it("compte tout le contrat s'il est dans la période", () => {
    expect(partDansPeriode(c({}), "2026-07-01", "2026-07-31")).toBe(1);
  });
  it("répartit au prorata des jours calendaires", () => {
    // 30 juin → 2 juillet : 1 jour sur 3 en juin
    expect(partDansPeriode(c({ date_debut: "2026-06-30", date_fin: "2026-07-02" }), "2026-06-01", "2026-06-30")).toBeCloseTo(1 / 3);
  });
  it("utilise les jours travaillés quand ils sont connus", () => {
    const contrat = c({ date_debut: "2026-06-29", date_fin: "2026-07-03", jours_travailles: ["2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03"] });
    expect(partDansPeriode(contrat, "2026-07-01", "2026-07-31")).toBe(0.75);
  });
});

describe("cumulPeriode", () => {
  it("convertit les cachets (12 h) et ignore le régime général", () => {
    const r = cumulPeriode(
      [c({ heures: 0, cachets: 2 }), c({ heures: 10, annexe: "regime_general" }), c({ heures: 8 })],
      "2026-07-01",
      "2026-07-31",
      regles,
    );
    expect(r.heures).toBe(32);
    expect(r.brut).toBe(108000);
  });
});

describe("compteur", () => {
  it("sans droits : 12 mois jusqu'à aujourd'hui", () => {
    const r = compteur([c({ heures: 500 }), c({ date_debut: "2025-01-05", date_fin: "2025-01-06", heures: 100 })], { droits_ouverts: false, date_anniversaire: null }, regles, "2026-10-11");
    expect(r.debut).toBe("2025-10-12");
    expect(r.fin).toBe("2026-10-11");
    expect(r.heures).toBe(500);
    expect(r.manquant).toBe(7);
  });
  it("droits ouverts : 12 mois avant la date anniversaire, avec les contrats à venir", () => {
    const r = compteur(
      [c({ heures: 300 }), c({ date_debut: "2026-11-02", date_fin: "2026-11-06", heures: 50 })],
      { droits_ouverts: true, date_anniversaire: "2027-03-01" },
      regles,
      "2026-10-11",
    );
    expect(r.debut).toBe("2026-03-02");
    expect(r.heures).toBe(300);
    expect(r.heuresPrevues).toBe(50);
    expect(r.total).toBe(350);
    expect(r.projection.estimeALaDate).toBeGreaterThan(350);
  });
});

describe("allocationJournaliere", () => {
  it("applique A + B + C avec les valeurs du fichier", () => {
    // 507 h, 12 000 € : A = 31,96 × 0,42 × 12000 / 5000 ; B = 31,96 × 0,26 × 507 / 507 ; C = 31,96 × 0,4
    const r = allocationJournaliere(12000, 507, regles);
    expect(r.A).toBeCloseTo((31.96 * 0.42 * 12000) / 5000, 2);
    expect(r.B).toBeCloseTo(31.96 * 0.26, 2);
    expect(r.C).toBeCloseTo(31.96 * 0.4, 2);
    expect(r.finale).toBeCloseTo(r.A + r.B + r.C, 1);
    expect(r.borne).toBeNull();
  });
  it("applique le plancher", () => {
    const r = allocationJournaliere(0, 0, regles);
    expect(r.finale).toBe(38);
    expect(r.borne).toBe("plancher");
  });
  it("prend en compte les règles modifiées", () => {
    const r = allocationJournaliere(0, 0, appliquerModifications([{ cle: "aj_plancher", valeur: 40 }]));
    expect(r.finale).toBe(40);
  });
});

describe("recapMois", () => {
  it("liste les contrats du mois avec jours, heures et employeurs", () => {
    const r = recapMois([c({ employeur: "DISSIDENCE" }), c({ date_debut: "2026-06-29", date_fin: "2026-07-02", heures: 32, salaire_brut: 80000, employeur: "OCURENS" })], "2026-07", regles);
    expect(r.lignes).toHaveLength(2);
    expect(r.employeurs).toEqual(["DISSIDENCE", "OCURENS"]);
    expect(r.heures).toBe(24 + 16);
    expect(r.brut).toBe(54000 + 40000);
    expect(r.jours).toBe(3 + 2);
  });
});

describe("netAttendu", () => {
  it("prend le net de la fiche de paie, sinon l'estime avec le rapport net / brut habituel", async () => {
    const { netAttendu, ratioNetBrut } = await import("./revenus");
    const ratio = ratioNetBrut([
      { salaire_brut: 100000, salaire_net: 78000 },
      { salaire_brut: 50000, salaire_net: 40000 },
      { salaire_brut: 40000, salaire_net: null },
    ]);
    expect(ratio).toBeCloseTo(118000 / 150000);
    expect(netAttendu({ salaire_brut: 40000, salaire_net: null }, ratio)).toEqual({ montant: Math.round(40000 * ratio), estime: true });
    expect(netAttendu({ salaire_brut: 40000, salaire_net: 31000 }, ratio)).toEqual({ montant: 31000, estime: false });
    expect(ratioNetBrut([])).toBe(0.78);
  });
});
