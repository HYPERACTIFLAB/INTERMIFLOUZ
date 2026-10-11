import { ajouterMois, bornesMois } from "./dates";
import { partDansPeriode, type ContratCalcul } from "./intermittence";

/** Salaires nets (centimes) des 12 derniers mois, répartis selon les jours travaillés. */
export function salairesParMois(contrats: (ContratCalcul & { salaire_net: number | null })[], aujourdhui: string, nbMois = 12) {
  const mois: { mois: string; net: number; contrats: number }[] = [];
  for (let i = nbMois - 1; i >= 0; i--) {
    const m = ajouterMois(aujourdhui.slice(0, 7) + "-01", -i).slice(0, 7);
    const { debut, fin } = bornesMois(m);
    let net = 0;
    let n = 0;
    for (const c of contrats) {
      const part = partDansPeriode(c, debut, fin);
      if (part > 0) {
        n++;
        net += (c.salaire_net ?? 0) * part;
      }
    }
    mois.push({ mois: m, net: Math.round(net), contrats: n });
  }
  return mois;
}
