import { ajouterMois, bornesMois } from "./dates";
import { partDansPeriode, type ContratCalcul } from "./intermittence";

type AvecSalaires = { salaire_brut: number | null; salaire_net: number | null };

/** Rapport net / brut observé sur tes contrats qui ont les deux montants (sinon environ 78 %). */
export function ratioNetBrut(contrats: AvecSalaires[]) {
  const complets = contrats.filter((c) => c.salaire_brut && c.salaire_net);
  const brut = complets.reduce((s, c) => s + c.salaire_brut!, 0);
  const net = complets.reduce((s, c) => s + c.salaire_net!, 0);
  return brut > 0 ? net / brut : 0.78;
}

/** Net attendu (centimes) : celui de la fiche de paie, ou estimé à partir du brut. */
export function netAttendu(c: AvecSalaires, ratio: number): { montant: number | null; estime: boolean } {
  if (c.salaire_net !== null) return { montant: c.salaire_net, estime: false };
  if (c.salaire_brut !== null) return { montant: Math.round(c.salaire_brut * ratio), estime: true };
  return { montant: null, estime: false };
}

/**
 * Salaires nets (centimes) des 12 derniers mois, répartis selon les jours travaillés.
 * Sans fiche de paie, le net est estimé à partir du brut.
 */
export function salairesParMois(contrats: (ContratCalcul & { salaire_net: number | null })[], aujourdhui: string, nbMois = 12) {
  const ratio = ratioNetBrut(contrats);
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
        net += (netAttendu(c, ratio).montant ?? 0) * part;
      }
    }
    mois.push({ mois: m, net: Math.round(net), contrats: n });
  }
  return mois;
}
