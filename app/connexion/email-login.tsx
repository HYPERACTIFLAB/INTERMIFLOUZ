"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { envoyerCode, verifierCode, type CodeState } from "./actions";

export function EmailLogin() {
  const [envoi, envoyer] = useActionState<CodeState, FormData>(envoyerCode, { etape: "email" });
  const [verif, verifier] = useActionState<CodeState, FormData>(verifierCode, { etape: "code" });

  if (envoi.etape === "email") {
    return (
      <form action={envoyer} className="space-y-3 text-left">
        <label htmlFor="email" className="label">Ton adresse e-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={envoi.email} className="input" placeholder="prenom.nom@gmail.com" />
        {envoi.error && <p role="alert" className="text-sm text-danger">{envoi.error}</p>}
        <SubmitButton className="btn-primary w-full" pendingLabel="Envoi…">Recevoir un code</SubmitButton>
      </form>
    );
  }

  return (
    <form action={verifier} className="space-y-3 text-left">
      <p className="text-sm text-muted">{envoi.info}</p>
      <input type="hidden" name="email" value={envoi.email} />
      <label htmlFor="code" className="label">Code reçu par e-mail</label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        className="input text-center text-2xl tracking-[0.4em]"
        placeholder="000000"
      />
      {verif.error && <p role="alert" className="text-sm text-danger">{verif.error}</p>}
      <SubmitButton className="btn-primary w-full" pendingLabel="Vérification…">Se connecter</SubmitButton>
      <button type="button" onClick={() => window.location.reload()} className="w-full text-center text-sm text-accent">
        Recevoir un nouveau code
      </button>
      <p className="text-center text-xs text-muted">Pas reçu ? Regarde dans les spams. Un nouveau code peut être demandé toutes les minutes.</p>
    </form>
  );
}
