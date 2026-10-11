import { ExternalLink } from "lucide-react";

/** Aperçu d'un document privé (lien temporaire). */
export function DocumentPreview({ url, mime, nom }: { url: string | null; mime: string; nom: string }) {
  if (!url) return <p className="text-sm text-muted">Aperçu indisponible.</p>;
  return (
    <div className="space-y-2">
      {mime === "application/pdf" ? (
        <iframe src={url} title={nom} className="hidden h-[70vh] w-full rounded-xl border border-border bg-white md:block" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- lien temporaire Supabase, pas d'optimisation possible
        <img src={url} alt={nom} className="max-h-[70vh] w-full rounded-xl border border-border object-contain" />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent">
        <ExternalLink size={14} aria-hidden /> Ouvrir {nom}
      </a>
    </div>
  );
}
