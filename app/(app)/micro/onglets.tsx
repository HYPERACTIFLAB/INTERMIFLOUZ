"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/micro", label: "Vue d'ensemble" },
  { href: "/micro/factures", label: "Factures" },
  { href: "/micro/devis", label: "Devis" },
  { href: "/micro/encaissements", label: "Encaissements" },
];

/** Onglets de la rubrique micro-entreprise. */
export function OngletsMicro() {
  const chemin = usePathname();
  return (
    <nav aria-label="Micro-entreprise" className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-border">
        {ONGLETS.map((o) => {
          const actif = o.href === "/micro" ? chemin === "/micro" : chemin.startsWith(o.href);
          return (
            <li key={o.href}>
              <Link
                href={o.href}
                aria-current={actif ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                  actif ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {o.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
