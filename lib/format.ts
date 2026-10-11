const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** 123456 (centimes) → « 1 234,56 € ». */
export function formatEuros(centimes: number | null | undefined) {
  if (centimes === null || centimes === undefined) return "—";
  return eur.format(centimes / 100);
}

export function formatNombre(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return nombre.format(n);
}

/** « 2026-10-11 » → « 11 oct. 2026 ». */
export function formatDate(iso: string | null | undefined, style: "court" | "long" = "court") {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: style === "court" ? "short" : "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(d);
}

export function formatPeriode(debut: string, fin: string) {
  return debut === fin ? formatDate(debut) : `${formatDate(debut)} → ${formatDate(fin)}`;
}

/** « 1 234,56 » ou « 1234.56 » → 123456 centimes. null si vide ou invalide. */
export function parseEurosEnCentimes(texte: string | null | undefined): number | null {
  if (!texte) return null;
  const propre = texte.replace(/\s|€/g, "").replace(",", ".");
  if (propre === "") return null;
  const n = Number(propre);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** 123456 → « 1234,56 » pour pré-remplir un champ. */
export function centimesVersSaisie(centimes: number | null | undefined) {
  if (centimes === null || centimes === undefined) return "";
  return (centimes / 100).toFixed(2).replace(".", ",");
}

export function parseNombre(texte: string | null | undefined): number | null {
  if (!texte) return null;
  const n = Number(texte.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** « Du jeudi 16 au samedi 18/07/2026 », comme Movinmotion. */
export function formatPeriodeLongue(debut: string, fin: string) {
  const jour = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
  const complet = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
      .format(new Date(iso + "T12:00:00Z"));
  if (debut === fin) return `Le ${complet(debut)}`;
  if (debut.slice(0, 7) === fin.slice(0, 7)) return `Du ${jour(debut)} au ${complet(fin)}`;
  return `Du ${complet(debut)} au ${complet(fin)}`;
}
