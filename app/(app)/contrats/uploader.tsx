"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_FILE_BYTES, SUPPORTED_MIME } from "@/lib/extraction/config";
import { ajouterDocument, creerDocumentImport, type NouveauDocument } from "./actions";
import { lancerLecture, lireDocument } from "./lecture";

type Etat =
  | { etape: "choix" }
  | { etape: "envoi"; numero?: number; total?: number }
  | { etape: "lecture" }
  | { etape: "erreur"; message: string };

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
};

export function Uploader({ userId, mode, contratId }: Props) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ etape: "choix" });
  const [type, setType] = useState<NouveauDocument["type"]>(mode === "import" ? "contrat" : "fiche_paie");
  const fichierRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);

  /** Vérifie, dépose le fichier dans le stockage privé et renvoie sa description. */
  async function deposer(file: File): Promise<NouveauDocument | string> {
    if (!(SUPPORTED_MIME as readonly string[]).includes(file.type)) {
      return `${file.name} : format non pris en charge (PDF, JPEG, PNG ou WebP).`;
    }
    if (file.size > MAX_FILE_BYTES) return `${file.name} : fichier trop lourd (20 Mo maximum).`;

    const chemin = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("documents").upload(chemin, file, { contentType: file.type });
    if (error) return `${file.name} : l'envoi a échoué (${error.message}).`;

    return {
      chemin,
      nomFichier: file.name || `document.${EXTENSIONS[file.type]}`,
      mime: file.type as NouveauDocument["mime"],
      taille: file.size,
      type,
      contratId: contratId ?? null,
    };
  }

  async function envoyer(liste: FileList | null) {
    const files = Array.from(liste ?? []);
    if (files.length === 0) return;
    if (files.length > 1) return envoyerPlusieurs(files);

    setEtat({ etape: "envoi" });
    const doc = await deposer(files[0]);
    if (typeof doc === "string") {
      setEtat({ etape: "erreur", message: doc });
      return;
    }

    if (mode === "ajout") {
      const res = await ajouterDocument(doc);
      if (res.error) setEtat({ etape: "erreur", message: res.error });
      else {
        setEtat({ etape: "choix" });
        router.refresh();
      }
      return;
    }

    const res = await creerDocumentImport(doc);
    if (res.error || !res.documentId) {
      setEtat({ etape: "erreur", message: res.error ?? "Erreur inconnue." });
      return;
    }
    if (res.lecture) {
      setEtat({ etape: "lecture" });
      await lireDocument(res.documentId);
    }
    router.push(`/contrats/importer/${res.documentId}`);
  }

  /** Import groupé : dépose tous les fichiers, lance les lectures, puis renvoie vers la liste. */
  async function envoyerPlusieurs(files: File[]) {
    const erreurs: string[] = [];
    for (const [i, file] of files.entries()) {
      setEtat({ etape: "envoi", numero: i + 1, total: files.length });
      const doc = await deposer(file);
      if (typeof doc === "string") {
        erreurs.push(doc);
        continue;
      }
      if (mode === "ajout") {
        const res = await ajouterDocument(doc);
        if (res.error) erreurs.push(`${file.name} : ${res.error}`);
        continue;
      }
      const res = await creerDocumentImport(doc);
      if (res.error || !res.documentId) erreurs.push(`${file.name} : ${res.error ?? "erreur inconnue"}`);
      else if (res.lecture) await lancerLecture(res.documentId);
    }

    if (erreurs.length) setEtat({ etape: "erreur", message: erreurs.join(" ") });
    else setEtat({ etape: "choix" });
    if (mode === "ajout") router.refresh();
    else if (!erreurs.length) router.push("/contrats");
  }

  if (etat.etape === "envoi" || etat.etape === "lecture") {
    return (
      <div className="card flex flex-col items-center px-6 py-12 text-center" aria-live="polite">
        <Loader2 size={32} className="animate-spin text-accent" aria-hidden />
        <p className="mt-4 font-medium">
          {etat.etape === "lecture"
            ? "Claude lit le document…"
            : etat.total
              ? `Envoi du fichier ${etat.numero} sur ${etat.total}…`
              : "Envoi du fichier…"}
        </p>
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

      {mode === "ajout" && (
        <div>
          <label htmlFor="type-ajout" className="label">Type de document</label>
          <select id="type-ajout" value={type} onChange={(e) => setType(e.target.value as NouveauDocument["type"])} className="input">
            <option value="fiche_paie">Fiche de paie</option>
            <option value="aem">Attestation employeur (AEM)</option>
            <option value="contrat">Contrat de travail</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      )}

      {mode === "import" ? (
        // Zone de dépôt : on peut aussi glisser des fichiers depuis l'ordinateur.
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setSurvol(true);
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSurvol(false);
            envoyer(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            survol ? "border-accent bg-accent-soft" : "border-border"
          }`}
        >
          <FileUp size={32} className="text-accent" aria-hidden />
          <p className="mt-3 font-medium">Contrats, bulletins de salaire, AEM…</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Mets-les tous d&apos;un coup, dans n&apos;importe quel ordre : l&apos;appli regroupe les documents d&apos;un même tournage.
          </p>
          <div className="mt-5 grid w-full max-w-md gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => fichierRef.current?.click()} className="btn-primary py-3.5">
              <FileUp size={20} aria-hidden /> Choisir des fichiers
            </button>
            <button type="button" onClick={() => photoRef.current?.click()} className="btn-secondary py-3.5">
              <Camera size={20} aria-hidden /> Prendre une photo
            </button>
          </div>
          <p className="mt-3 hidden text-xs text-muted md:block">ou glisse-les ici</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => fichierRef.current?.click()} className="btn-primary py-3">
            <FileUp size={20} aria-hidden /> Choisir un fichier
          </button>
          <button type="button" onClick={() => photoRef.current?.click()} className="btn-secondary py-3">
            <Camera size={20} aria-hidden /> Prendre une photo
          </button>
        </div>
      )}
      <input
        ref={fichierRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => {
          envoyer(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          envoyer(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
