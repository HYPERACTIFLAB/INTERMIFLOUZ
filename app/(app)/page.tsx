import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/navigation";

export default async function AccueilPage() {
  const user = await getCurrentUser();
  const firstName = user.name?.split(" ")[0];
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date());

  return (
    <>
      <PageHeader title={firstName ? `Bonjour ${firstName}` : "Bonjour"} description={today} />

      <section aria-labelledby="rubriques" className="space-y-3">
        <h2 id="rubriques" className="text-sm font-medium uppercase tracking-wide text-muted">
          Rubriques
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NAV_ITEMS.filter((i) => i.href !== "/").map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.label}</span>
                    <span className="block truncate text-sm text-muted">{item.description}</span>
                  </span>
                  <ChevronRight size={18} className="text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
