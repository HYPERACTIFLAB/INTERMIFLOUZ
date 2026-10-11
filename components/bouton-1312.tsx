"use client";

import { useState } from "react";

/** Easter egg : la voix du téléphone crie « ACAAAAAB ». */
export function Bouton1312() {
  const [cri, setCri] = useState(false);

  function crier() {
    if (!("speechSynthesis" in window)) return;
    const synthese = window.speechSynthesis;
    synthese.cancel();
    const u = new SpeechSynthesisUtterance("A! Cé! Aaaaaaaaaaaaaah! Bé!");
    u.lang = "fr-FR";
    u.voice = synthese.getVoices().find((v) => v.lang.startsWith("fr")) ?? null;
    u.volume = 1;
    u.rate = 0.9;
    u.pitch = 1.4;
    u.onstart = () => setCri(true);
    u.onend = () => setCri(false);
    u.onerror = () => setCri(false);
    synthese.speak(u);
    navigator.vibrate?.([80, 60, 80, 60, 400, 60, 120]);
  }

  return (
    <button
      type="button"
      onClick={crier}
      aria-label="1312"
      className={`rounded-xl bg-foreground px-4 py-2 font-mono text-lg font-black tracking-widest text-background transition-transform active:scale-95 ${
        cri ? "animate-pulse" : ""
      }`}
    >
      1312
    </button>
  );
}
