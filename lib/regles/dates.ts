/** Petites fonctions de dates sur des chaînes AAAA-MM-JJ (en UTC, sans fuseau). */
const JOUR = 86_400_000;

export const versDate = (iso: string) => new Date(iso + "T00:00:00Z");
export const versIso = (d: Date) => d.toISOString().slice(0, 10);
export const ajouterJours = (iso: string, n: number) => versIso(new Date(versDate(iso).getTime() + n * JOUR));
/** Nombre de jours de a à b inclus (b ≥ a). */
export const joursInclus = (a: string, b: string) => Math.round((versDate(b).getTime() - versDate(a).getTime()) / JOUR) + 1;
export const maxIso = (a: string, b: string) => (a > b ? a : b);
export const minIso = (a: string, b: string) => (a < b ? a : b);
export const aujourdhui = () => versIso(new Date());

/** Même jour, n mois plus tard (borné à la fin du mois). */
export function ajouterMois(iso: string, n: number) {
  const d = versDate(iso);
  const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(d.getUTCDate(), dernier));
  return versIso(cible);
}

/** Premier et dernier jour d'un mois « AAAA-MM ». */
export function bornesMois(mois: string) {
  const [a, m] = mois.split("-").map(Number);
  const fin = new Date(Date.UTC(a, m, 0));
  return { debut: `${mois}-01`, fin: versIso(fin) };
}
