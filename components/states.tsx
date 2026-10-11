import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Icon size={32} className="text-muted" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      {children && <div className="mt-2 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function DemoNotice() {
  return (
    <div className="card p-6 text-sm text-muted">
      Mode démo : cette rubrique a besoin de la base de données Supabase. Suis la section
      « Mise en route » du README pour la configurer.
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}
