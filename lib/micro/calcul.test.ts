import { describe, expect, it } from "vitest";
import { appliquerModifications } from "@/lib/regles/regles";
import { caParMois, echeancesUrssaf, enRetard, plafondAnnee, tauxPrelevement, totalLignes } from "./calcul";

const regles = appliquerModifications([]);

describe("totalLignes", () => {
  it("additionne quantité × prix, arrondi au centime", () => {
    expect(totalLignes([
      { description: "Journée de tournage", quantite: 2, unite: "jour", prix_unitaire: 45000 },
      { description: "Retouches", quantite: 1.5, unite: "h", prix_unitaire: 3333 },
    ])).toBe(90000 + 5000);
  });
});

describe("tauxPrelevement", () => {
  it("cotisations + VL + CFP la 1re année, + chambre de métiers ensuite", () => {
    expect(tauxPrelevement(regles, "2026-11", "2026-08-12")).toBeCloseTo(21.2 + 1.7 + 0.3);
    expect(tauxPrelevement(regles, "2027-01", "2026-08-12")).toBeCloseTo(21.2 + 1.7 + 0.3 + 0.48);
  });
});

describe("echeancesUrssaf", () => {
  const ca = caParMois([
    { date: "2026-09-10", montant: 100000 },
    { date: "2026-11-02", montant: 50000 },
    { date: "2026-12-15", montant: 20000 },
  ]);
  it("regroupe les premiers mois jusqu'au 31 décembre pour un début le 12 août", () => {
    const e = echeancesUrssaf("2026-08-12", "2027-01-10", ca, new Set(), regles);
    expect(e[0]).toMatchObject({ mois: ["2026-08", "2026-09", "2026-10", "2026-11"], date_limite: "2026-12-31", ca: 150000, statut: "en_retard" });
    expect(e[0].montant).toBe(Math.round(150000 * 0.232));
    expect(e[1]).toMatchObject({ mois: ["2026-12"], date_limite: "2027-01-31", ca: 20000, statut: "a_faire" });
    expect(e[2]).toMatchObject({ mois: ["2027-01"], statut: "a_venir" });
  });
  it("marque faite quand tous les mois sont déclarés", () => {
    const e = echeancesUrssaf("2026-08-12", "2026-12-05", ca, new Set(["2026-08", "2026-09", "2026-10", "2026-11"]), regles);
    expect(e[0].statut).toBe("faite");
  });
});

describe("plafondAnnee", () => {
  it("proratise l'année de création", () => {
    // 12 août → 31 décembre : 142 jours sur 365
    expect(plafondAnnee(regles, 2026, "2026-08-12")).toBe(Math.round((8360000 * 142) / 365));
    expect(plafondAnnee(regles, 2027, "2026-08-12")).toBe(8360000);
  });
});

describe("enRetard", () => {
  it("seulement les factures émises après l'échéance", () => {
    expect(enRetard({ statut: "emise", date_echeance: "2026-10-01" }, "2026-10-23")).toBe(true);
    expect(enRetard({ statut: "payee", date_echeance: "2026-10-01" }, "2026-10-23")).toBe(false);
  });
});
