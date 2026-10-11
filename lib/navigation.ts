import {
  BarChart3,
  Briefcase,
  CalendarDays,
  FileText,
  Gauge,
  Home,
  Receipt,
  Settings,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Libellé court pour la barre du bas sur mobile. */
  short?: string;
  icon: LucideIcon;
  description: string;
  /** Étape du plan où la rubrique est construite. */
  etape: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: Home, description: "Vue d'ensemble", etape: "0" },
  { href: "/contrats", label: "Contrats", icon: FileText, description: "Contrats d'intermittence et import PDF", etape: "a" },
  { href: "/intermittence", label: "Intermittence", short: "Heures", icon: Gauge, description: "Compteur 507 h et récap d'actualisation", etape: "b" },
  { href: "/frais", label: "Notes de frais", short: "Frais", icon: Receipt, description: "Justificatifs scannés et remboursements", etape: "c" },
  { href: "/micro", label: "Micro-entreprise", icon: Briefcase, description: "CA, URSSAF, devis et factures", etape: "d" },
  { href: "/finances", label: "Finances", icon: BarChart3, description: "Revenus par source et simulateur", etape: "e" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, description: "Synchronisation Google Agenda", etape: "f" },
  { href: "/contacts", label: "Contacts", icon: Users, description: "Sociétés de production et interlocuteurs", etape: "a" },
  { href: "/regles", label: "Règles de calcul", icon: SlidersHorizontal, description: "Seuils et formules modifiables, avec sources", etape: "b" },
  { href: "/parametres", label: "Paramètres", icon: Settings, description: "Ton entreprise, ton compte, exports", etape: "d" },
];

/** Les 4 rubriques visibles en permanence dans la barre du bas (mobile). */
export const MOBILE_TABS = ["/", "/contrats", "/intermittence", "/frais"];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
