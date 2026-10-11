"use client";

import { useState } from "react";
import { formatEuros } from "@/lib/format";

const formatValeur = (centimes: number) => formatEuros(Math.round(centimes));

/** `valeur` en centimes d'euro. */
export type Barre = { cle: string; libelle: string; court: string; valeur: number; detail: string };

/**
 * Histogramme simple à une série (barres fines, coins arrondis côté données),
 * avec infobulle au survol ou au toucher. Le titre est porté par la section parente.
 */
export function BarChart({ barres }: { barres: Barre[] }) {
  const [actif, setActif] = useState<number | null>(null);
  const max = Math.max(1, ...barres.map((b) => b.valeur));
  const H = 140;
  const courant = actif === null ? null : barres[actif];

  return (
    <div>
      <div className="mb-2 h-10 text-sm" aria-live="polite">
        {courant ? (
          <>
            <p className="font-medium capitalize">{courant.libelle}</p>
            <p className="text-muted tabular-nums">
              {formatValeur(courant.valeur)} · {courant.detail}
            </p>
          </>
        ) : (
          <p className="text-muted">Touche une barre pour voir le détail.</p>
        )}
      </div>
      <div className="relative" style={{ height: H + 22 }} onMouseLeave={() => setActif(null)}>
        {/* ligne de base et repère du maximum, discrets */}
        <div className="absolute inset-x-0 border-t border-border" style={{ top: H }} />
        <div className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: 0 }} />
        <span className="absolute right-0 -top-0.5 -translate-y-full text-[10px] text-muted tabular-nums">{formatValeur(max)}</span>
        <div className="absolute inset-x-0 top-0 flex items-end gap-[2px]" style={{ height: H }}>
          {barres.map((b, i) => (
            <button
              key={b.cle}
              type="button"
              className="group flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setActif(i)}
              onFocus={() => setActif(i)}
              onClick={() => setActif(i)}
              aria-label={`${b.libelle} : ${formatValeur(b.valeur)}`}
            >
              <span
                className={`block w-full max-w-7 rounded-t-[4px] transition-opacity ${actif === null || actif === i ? "opacity-100" : "opacity-40"} ${b.valeur > 0 ? "bg-accent" : ""}`}
                style={{ height: b.valeur > 0 ? Math.max(3, (b.valeur / max) * H) : 0 }}
              />
            </button>
          ))}
        </div>
        <div className="absolute inset-x-0 flex gap-[2px]" style={{ top: H + 6 }}>
          {barres.map((b, i) => (
            <span key={b.cle} className={`flex-1 text-center text-[10px] ${actif === i ? "font-medium text-foreground" : "text-muted"}`}>
              {b.court}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <tbody>
          {barres.map((b) => (
            <tr key={b.cle}>
              <th>{b.libelle}</th>
              <td>{formatValeur(b.valeur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
