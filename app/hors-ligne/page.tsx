export const metadata = { title: "Hors ligne" };

export default function HorsLignePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">Pas de connexion</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Intermiflouze a besoin d&apos;internet pour accéder à tes données. Réessaie dès que le
        réseau revient.
      </p>
    </main>
  );
}
