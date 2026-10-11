"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_FILE_BYTES, SUPPORTED_MIME } from "@/lib/extraction/config";
import { lancerLecture, lireDocument } from "../contrats/lecture";
import { creerJustificatif } from "./actions";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Dépôt de justificatifs (photo ou fichiers) puis lecture par Claude. */
export function Scanner({ userId }: { userId: string }) {
  const router = useRouter();
  const [etat, setEtat] = useState<{ texte: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const fichiers = useRef<HTMLInputElement>(null);
  const photo = useRef<HTMLInputElement>(null);

  async function envoyer(liste: FileList | null) {
    const files = Array.from(liste ?? []);
    if (!files.length) return;
    setErreur(null);
    const erreurs: string[] = [];
    let dernier: string | null = null;
    for (const [i, file] of files.entries()) {
      setEtat({ texte: files.length > 1 ? `Envoi ${i + 1} sur ${files.length}…` : "Envoi du justificatif…" });
      if (!(SUPPORTED_MIME as readonly string[]).includes(file.type) || file.size > MAX_FILE_BYTES) {
        erreurs.push(`${file.name} : format ou taille non accepté.`);
        continue;
      }
      const chemin = `${userId}/${crypto.randomUUID()}.${EXT[file.type]}`;
      const { error } = await createClient().storage.from("documents").upload(chemin, file, { contentType: file.type });
      if (error) {
        erreurs.push(`${file.name} : ${error.message}`);
        continue;
      }
      const res = await creerJustificatif({ chemin, nomFichier: file.name || "justificatif", mime: file.type as (typeof SUPPORTED_MIME)[number], taille: file.size });
      if (res.error || !res.documentId) {
        erreurs.push(`${file.name} : ${res.error}`);
        continue;
      }
      dernier = res.documentId;
      if (res.lecture) {
        if (files.length === 1) {
          setEtat({ texte: "Claude lit le justificatif…" });
          await lireDocument(res.documentId);
        } else await lancerLecture(res.documentId);
      }
    }
    setEtat(null);
    if (erreurs.length) setErreur(erreurs.join(" "));
    if (files.length === 1 && dernier && !erreurs.length) router.push(`/frais/importer/${dernier}`);
    else router.refresh();
  }

  if (etat) {
    return (
      <div className="card flex items-center justify-center gap-3 px-4 py-6" aria-live="polite">
        <Loader2 size={22} className="animate-spin text-accent" aria-hidden />
        <span className="font-medium">{etat.texte}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {erreur && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{erreur}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => photo.current?.click()} className="btn-primary py-3.5">
          <Camera size={20} aria-hidden /> Photographier
        </button>
        <button type="button" onClick={() => fichiers.current?.click()} className="btn-secondary py-3.5">
          <FileUp size={20} aria-hidden /> Fichiers
        </button>
      </div>
      <input ref={photo} type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={(e) => { envoyer(e.target.files); e.target.value = ""; }} />
      <input ref={fichiers} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { envoyer(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
