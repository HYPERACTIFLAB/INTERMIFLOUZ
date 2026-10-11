"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function Copier({ texte }: { texte: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary w-full sm:w-auto"
      onClick={async () => {
        await navigator.clipboard.writeText(texte);
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
    >
      {ok ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
      {ok ? "Copié" : "Copier le récap"}
    </button>
  );
}
