import { describe, expect, it } from "vitest";
import { blocsJours, evenementsContrat, idEvenement } from "./evenements";

const contrat = {
  id: "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
  date_debut: "2026-07-16",
  date_fin: "2026-07-22",
  jours_travailles: [] as string[],
  heures: 24,
  cachets: 0,
  salaire_brut: 54000,
  poste: "Régisseur",
  employeur: "BIRTH",
  projet: "PEACE TEA",
};

describe("blocsJours", () => {
  it("prend toute la période si les jours ne sont pas connus", () => {
    expect(blocsJours(contrat)).toEqual([["2026-07-16", "2026-07-22"]]);
  });
  it("regroupe les jours consécutifs, même dans le désordre et en changeant de mois", () => {
    expect(blocsJours({ ...contrat, jours_travailles: ["2026-07-31", "2026-07-30", "2026-08-01", "2026-08-04"] })).toEqual([
      ["2026-07-30", "2026-08-01"],
      ["2026-08-04", "2026-08-04"],
    ]);
  });
});

describe("evenementsContrat", () => {
  it("crée des événements journée entière avec une fin exclue et des identifiants valides pour Google", () => {
    const ev = evenementsContrat({ ...contrat, jours_travailles: ["2026-07-16", "2026-07-17", "2026-07-21"] }, "https://x.app");
    expect(ev).toHaveLength(2);
    expect(ev[0].summary).toBe("PEACE TEA (1/2)");
    expect(ev[0].start).toEqual({ date: "2026-07-16" });
    expect(ev[0].end).toEqual({ date: "2026-07-18" });
    expect(ev[1].end).toEqual({ date: "2026-07-22" });
    expect(ev[0].description).toContain("Employeur : BIRTH");
    expect(ev[0].description).toContain("https://x.app/contrats/" + contrat.id);
    for (const e of ev) expect(e.id).toMatch(/^[a-v0-9]{5,1024}$/);
  });
  it("garde le même identifiant d'une synchro à l'autre", () => {
    expect(idEvenement(contrat.id, 0)).toBe(idEvenement(contrat.id.toUpperCase(), 0));
  });
});
