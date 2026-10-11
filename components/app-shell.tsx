"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { MOBILE_TABS, NAV_ITEMS, isActive } from "@/lib/navigation";

type Props = {
  children: React.ReactNode;
  userEmail: string | null;
  demo: boolean;
};

export function AppShell({ children, userEmail, demo }: Props) {
  const pathname = usePathname();
  const tabs = NAV_ITEMS.filter((i) => MOBILE_TABS.includes(i.href));
  const plusActive = !tabs.some((t) => isActive(pathname, t.href));

  return (
    <div className="min-h-dvh md:flex">
      {/* Barre latérale (ordinateur) */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-surface">
        <div className="px-5 py-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Intermiflouze
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                <Icon size={18} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4 text-sm">
          <p className="truncate text-muted" title={userEmail ?? undefined}>
            {demo ? "Mode démo" : userEmail}
          </p>
          {!demo && (
            <form action="/auth/deconnexion" method="post" className="mt-2">
              <button className="flex items-center gap-2 text-muted hover:text-foreground">
                <LogOut size={16} aria-hidden /> Se déconnecter
              </button>
            </form>
          )}
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        {demo && (
          <div className="pt-safe bg-warning-soft px-4 py-2 text-center text-xs text-warning">
            Mode démo : Supabase n&apos;est pas encore configuré, rien n&apos;est enregistré.
          </div>
        )}
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-10">
          {children}
        </main>
      </div>

      {/* Barre du bas (mobile) */}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur md:hidden"
        aria-label="Navigation principale"
      >
        <ul className="grid grid-cols-5">
          {tabs.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                    active ? "font-medium text-accent" : "text-muted"
                  }`}
                >
                  <Icon size={22} aria-hidden />
                  {item.short ?? item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/plus"
              aria-current={plusActive ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                plusActive ? "font-medium text-accent" : "text-muted"
              }`}
            >
              <Menu size={22} aria-hidden />
              Plus
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
