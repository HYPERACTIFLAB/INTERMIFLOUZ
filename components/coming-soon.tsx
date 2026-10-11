import { NAV_ITEMS } from "@/lib/navigation";
import { PageHeader } from "./page-header";

/** Page provisoire pour une rubrique pas encore construite. */
export function ComingSoon({ href }: { href: string }) {
  const item = NAV_ITEMS.find((i) => i.href === href)!;
  const Icon = item.icon;
  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
        <Icon size={36} className="text-muted" aria-hidden />
        <p className="mt-4 font-medium">Bientôt disponible</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Cette rubrique sera construite à l&apos;étape {item.etape} du plan.
        </p>
      </div>
    </>
  );
}
