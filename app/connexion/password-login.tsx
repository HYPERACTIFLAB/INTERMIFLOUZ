"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { connexionMotDePasse, type LoginState } from "./actions";

export function PasswordLogin() {
  const [state, action] = useActionState<LoginState, FormData>(connexionMotDePasse, {});
  return (
    <form action={action} className="space-y-3 text-left">
      <div>
        <label htmlFor="email" className="label">Adresse e-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" pendingLabel="Connexion…">Se connecter</SubmitButton>
    </form>
  );
}
