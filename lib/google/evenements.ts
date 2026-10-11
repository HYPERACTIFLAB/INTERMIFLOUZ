import { ajouterJours } from "@/lib/regles/dates";
import { formatEuros, formatNombre } from "@/lib/format";
import { titreContrat } from "@/lib/titre";

export type ContratAgenda = {
  id: string;
  date_debut: string;
  date_fin: string;
  jours_travailles: string[];
  heures: number;
  cachets: number;
  salaire_brut: number | null;
  poste: string | null;
  employeur: string | null;
  projet: string | null;
};

/** Jours consécutifs regroupés : [["2026-07-16", "2026-07-18"], ["2026-07-21", "2026-07-21"]]. */
export function blocsJours(c: Pick<ContratAgenda, "date_debut" | "date_fin" | "jours_travailles">): [string, string][] {
  const jours = [...new Set(c.jours_travailles)].sort();
  if (!jours.length) return [[c.date_debut, c.date_fin]];
  const blocs: [string, string][] = [];
  for (const j of jours) {
    const dernier = blocs.at(-1);
    if (dernier && ajouterJours(dernier[1], 1) === j) dernier[1] = j;
    else blocs.push([j, j]);
  }
  return blocs;
}

/**
 * Identifiant d'événement Google fixé par l'appli (lettres a-v et chiffres, comme l'exige Google) :
 * le même contrat donne toujours les mêmes événements, ce qui permet de les mettre à jour sans doublon.
 */
export function idEvenement(contratId: string, index: number) {
  return `if${contratId.replace(/-/g, "").toLowerCase()}k${index}`;
}

/** Corps des événements Google d'un contrat (journées entières). */
export function evenementsContrat(c: ContratAgenda, appUrl: string | null) {
  const blocs = blocsJours(c);
  const titre = titreContrat(c);
  const lignes = [
    c.employeur && `Employeur : ${c.employeur}`,
    c.poste && `Poste : ${c.poste}`,
    Number(c.heures) > 0 && `Heures : ${formatNombre(Number(c.heures))} h`,
    c.cachets > 0 && `Cachets : ${c.cachets}`,
    c.salaire_brut !== null && `Brut : ${formatEuros(c.salaire_brut)}`,
    appUrl && `\nFiche du contrat : ${appUrl}/contrats/${c.id}`,
  ].filter(Boolean);
  return blocs.map(([debut, fin], i) => ({
    id: idEvenement(c.id, i),
    summary: blocs.length > 1 ? `${titre} (${i + 1}/${blocs.length})` : titre,
    description: lignes.join("\n"),
    start: { date: debut },
    // Google : la date de fin d'un événement « journée entière » est exclue.
    end: { date: ajouterJours(fin, 1) },
    transparency: "opaque",
    status: "confirmed",
    extendedProperties: { private: { intermiflouze_contrat: c.id } },
  }));
}
