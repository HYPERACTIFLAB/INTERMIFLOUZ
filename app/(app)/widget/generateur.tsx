"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { SubmitButton } from "@/components/ui";
import { ErrorBanner } from "@/components/states";
import { creerScriptWidget, type EtatWidget } from "./actions";

export function GenerateurWidget({ existe }: { existe: boolean }) {
  const [etat, action] = useActionState<EtatWidget, FormData>(creerScriptWidget, {});
  const [copie, setCopie] = useState(false);

  if (etat.script) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="btn-primary w-full py-3.5"
          onClick={async () => {
            await navigator.clipboard.writeText(etat.script!);
            setCopie(true);
          }}
        >
          {copie ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          {copie ? "Script copié" : "Copier le script"}
        </button>
        <p className="text-xs text-muted">
          Il contient ta clé perso : colle-le seulement dans Scriptable, ne l&apos;envoie à personne. Il ne sera plus affiché
          ensuite (tu pourras en recréer un).
        </p>
        <textarea readOnly value={etat.script} rows={6} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <ErrorBanner message={etat.error} />
      <SubmitButton pendingLabel="Création…" className="btn-primary w-full py-3.5">
        {existe ? "Créer un nouveau script" : "Créer mon script"}
      </SubmitButton>
      {existe && <p className="text-xs text-muted">L&apos;ancien script arrêtera de fonctionner.</p>}
    </form>
  );
}
