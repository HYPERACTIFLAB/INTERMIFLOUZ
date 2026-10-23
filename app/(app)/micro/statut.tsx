const COULEURS: Record<string, string> = {
  brouillon: "bg-background text-muted",
  envoye: "bg-accent-soft text-accent",
  accepte: "bg-accent-soft text-accent",
  refuse: "bg-background text-muted line-through",
  emise: "bg-warning-soft text-warning",
  en_retard: "bg-danger/10 text-danger",
  payee: "bg-accent-soft text-accent",
  annulee: "bg-background text-muted line-through",
};

export function Statut({ statut, libelle }: { statut: string; libelle: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${COULEURS[statut] ?? ""}`}>{libelle}</span>;
}
