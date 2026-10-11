"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_FILE_BYTES, SUPPORTED_MIME } from "@/lib/extraction/config";
import { ajouterDocument, analyserDocument, type NouveauDocument } from "./actions";

type Etat = { etape: "choix" } | { etape: "envoi" } | { etape: "lecture" } | { etape: "erreur"; message: string };

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type Props = {
  userId: string;
  /** Mode import : lecture par Claude puis écran de vérification. */
  mode: "import" | "ajout";
  contratId?: string;
  lectureActive?: boolean;
};

export function Uploader({ userId, mode, contratId, lectureActive = true }: Props) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ etape: "choix" });
  const [type, setType] = useState<NouveauDocument["type"]>(mode === "import" ? "contrat" : "fiche_paie");
  const fichierRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  async function envoyer(file: File | undefined) {
    if (!file) return;
    if (!(SUPPORTED_MIME as readonly string[]).includes(file.type)) {
      setEtat({ etape: "erreur", message: "Format non pris en charge. Utilise un PDF, une photo JPEG, PNG ou WebP." });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setEtat({ etape: "erreur", message: "Fichier trop lourd (20 Mo maximum)." });
      return;
    }

    setEtat({ etape: "envoi" });
    const chemin = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("documents").upload(chemin, file, { contentType: file.type });
    if (error) {
      setEtat({ etape: "erreur", message: "L'envoi du fichier a échoué : " + error.message });
      return;
    }

    const doc: NouveauDocument = {
      chemin,
      nomFichier: file.name || `document.${EXTENSIONS[file.type]}`,
      mime: file.type as NouveauDocument["mime"],
      taille: file.size,
      type,
      contratId: contratId ?? null,
    };

    if (mode === "ajout") {
      const res = await ajouterDocument(doc);
      if (res.error) setEtat({ etape: "erreur", message: res.error });
      else {
        setEtat({ etape: "choix" });
        router.refresh();
      }
      return;
    }

    if (lectureActive) setEtat({ etape: "lecture" });
    const res = await analyserDocument(doc);
    if (res.error || !res.documentId) {
      setEtat({ etape: "erreur", message: res.error ?? "Erreur inconnue." });
      return;
    }
    router.push(`/contrats/importer/${res.documentId}`);
  }

  if (etat.etape === "envoi" || etat.etape === "lecture") {
    return (
      <div className="card flex flex-col items-center px-6 py-12 text-center" aria-live="polite">
        <Loader2 size={32} className="animate-spin text-accent" aria-hidden />
        <p className="mt-4 font-medium">{etat.etape === "envoi" ? "Envoi du fichier…" : "Claude lit le document…"}</p>
        {etat.etape === "lecture" && <p className="mt-1 text-sm text-muted">Cela prend en général 10 à 40 secondes.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {etat.etape === "erreur" && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {etat.message}
        </p>
      )}

      <div>
        <label htmlFor={`type-${mode}`} className="label">Type de document</label>
        <select id={`type-${mode}`} value={type} onChange={(e) => setType(e.target.value as NouveauDocument["type"])} className="input">
          <option value="contrat">Contrat de travail</option>
          <option value="fiche_paie">Fiche de paie</option>
          <option value="aem">Attestation employeur (AEM)</option>
          <option value="autre">Autre</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => fichierRef.current?.click()} className="btn-primary py-4">
          <FileUp size={20} aria-hidden /> Choisir un fichier
        </button>
        <button type="button" onClick={() => photoRef.current?.click()} className="btn-secondary py-4">
          <Camera size={20} aria-hidden /> Prendre une photo
        </button>
      </div>
      <input
        ref={fichierRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => envoyer(e.target.files?.[0])}
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        onChange={(e) => envoyer(e.target.files?.[0])}
      />
    </div>
  );
}
