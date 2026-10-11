/** Titre d'un contrat : le projet en priorité, sinon le poste, sinon l'employeur. */
export function titreContrat(c: { projet?: string | null; poste?: string | null; employeur?: string | null }) {
  return c.projet || c.poste || c.employeur || "Contrat sans nom";
}

/** Ligne secondaire : la boîte de prod (et le poste si le titre est le projet). */
export function sousTitreContrat(c: { projet?: string | null; poste?: string | null; employeur?: string | null }) {
  const parts = c.projet ? [c.employeur, c.poste] : c.poste ? [c.employeur] : [];
  return parts.filter(Boolean).join(" · ");
}
