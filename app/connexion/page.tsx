import Image from "next/image";
import { GoogleSignInButton } from "./google-button";
import { DevLogin } from "./dev-login";
import { EmailLogin } from "./email-login";
import { supabaseConfigured } from "@/lib/config";

export const metadata = { title: "Connexion" };

const ERREURS: Record<string, string> = {
  "non-autorise": "Ce compte n'est pas autorisé à accéder à Intermiflouze.",
  echec: "La connexion a échoué. Réessaie.",
};

export default async function ConnexionPage({ searchParams }: PageProps<"/connexion">) {
  const { erreur } = await searchParams;
  const message = typeof erreur === "string" ? ERREURS[erreur] : undefined;

  return (
    <main className="pt-safe pb-safe flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <Image src="/icons/icon-192.png" alt="" width={64} height={64} className="mx-auto rounded-2xl" priority />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Intermiflouze</h1>
        <p className="mt-1 text-sm text-muted">Ton activité pro, au même endroit.</p>

        {message && (
          <p role="alert" className="mt-6 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
            {message}
          </p>
        )}

        <div className="mt-8">
          {supabaseConfigured ? (
            <>
              <EmailLogin />
              {process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1" && (
                <div className="mt-4">
                  <GoogleSignInButton />
                </div>
              )}
              {process.env.NODE_ENV === "development" && <DevLogin />}
            </>
          ) : (
            <p className="text-sm text-muted">
              L&apos;appli n&apos;est pas encore reliée à Supabase. Suis le README, section
              « Mise en route ».
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
