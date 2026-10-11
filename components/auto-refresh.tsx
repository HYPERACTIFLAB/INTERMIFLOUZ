"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recharge les données de la page à intervalle régulier (ex. lecture en cours). */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
