"use client";

import { useActionState } from "react";
import { ErrorBanner } from "@/components/states";
import { SubmitButton } from "@/components/ui";
import { changerMotDePasse, type MotDePasseState } from "./actions";

export function MotDePasseForm() {
  const [state, action] = useActionState<MotDePasseState, FormData>(changerMotDePasse, {});
  return (
    <form action={action} className="space-y-4">
      <ErrorBanner message={state.error} />
      <div>
        <label htmlFor="password" className="label">Nouveau mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" />
        <p className="mt-1 text-xs text-muted">Au moins 10 caractères. Safari peut en proposer un et le retenir pour toi.</p>
      </div>
      <div>
        <label htmlFor="confirmation" className="label">Confirme-le</label>
        <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={10} required className="input" />
      </div>
      <SubmitButton className="btn-primary w-full md:w-auto">Enregistrer mon mot de passe</SubmitButton>
    </form>
  );
}
