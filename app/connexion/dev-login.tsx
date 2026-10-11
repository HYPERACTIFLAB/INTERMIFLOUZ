"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Connexion par mot de passe, uniquement en développement local (tests). */
export function DevLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    if (error) setError(error.message);
    else router.replace("/");
  }

  return (
    <form action={onSubmit} className="mt-6 space-y-2 border-t border-border pt-6 text-left">
      <p className="text-xs text-muted">Développement local uniquement</p>
      <input name="email" type="email" placeholder="E-mail" className="input" defaultValue="test@intermiflouze.local" />
      <input name="password" type="password" placeholder="Mot de passe" className="input" />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn-secondary w-full">Connexion de test</button>
    </form>
  );
}
