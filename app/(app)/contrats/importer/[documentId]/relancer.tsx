"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { preparerRelance } from "../../actions";
import { lireDocument } from "../../lecture";

export function RelancerLecture({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function relancer() {
    setEnCours(true);
    setErreur(null);
    const res = await preparerRelance(documentId);
    if (res.error) {
      setErreur(res.error);
      setEnCours(false);
      return;
    }
    await lireDocument(documentId);
    setEnCours(false);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={relancer} disabled={enCours} className="btn-secondary text-sm">
        <RotateCw size={16} className={enCours ? "animate-spin" : ""} aria-hidden />
        {enCours ? "Claude lit le document…" : "Relancer la lecture"}
      </button>
      {erreur && <p className="mt-2 text-sm text-danger">{erreur}</p>}
    </div>
  );
}
