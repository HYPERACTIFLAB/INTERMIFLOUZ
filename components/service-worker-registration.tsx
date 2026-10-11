"use client";

import { useEffect } from "react";

/** Enregistre le service worker (nécessaire pour l'installation et la page hors ligne). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
