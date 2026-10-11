import Link from "next/link";
import { ChevronRight, KeyRound, LogOut } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { demoMode } from "@/lib/config";
import { MOBILE_TABS, NAV_ITEMS } from "@/lib/navigation";

export const metadata = { title: "Plus" };

export default function PlusPage() {
  const items = NAV_ITEMS.filter((i) => !MOBILE_TABS.includes(i.href));
  return (
    <>
      <PageHeader title="Plus" />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-4 px-4 py-3.5">
                <Icon size={20} className="text-accent" aria-hidden />
                <span className="flex-1">{item.label}</span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {!demoMode && (
        <Link href="/mot-de-passe" className="card mt-6 flex items-center gap-4 px-4 py-3.5">
          <KeyRound size={20} className="text-accent" aria-hidden />
          <span className="flex-1">Changer mon mot de passe</span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </Link>
      )}
      {!demoMode && (
        <form action="/auth/deconnexion" method="post" className="mt-6">
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-danger">
            <LogOut size={18} aria-hidden /> Se déconnecter
          </button>
        </form>
      )}
    </>
  );
}
