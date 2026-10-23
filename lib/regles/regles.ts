import config from "@/config/regles.json";

export type Regle = {
  libelle: string;
  valeur: number;
  unite: string;
  description: string;
  source: string;
  url: string;
  verifie_le: string;
  a_verifier: boolean;
  /** Rubrique d'affichage dans la page Règles (intermittence par défaut). */
  groupe?: "micro";
};

export type CleRegle = keyof typeof config.regles;
export type Regles = Record<CleRegle, Regle> & { _modifiees: CleRegle[] };

export const REGLES_PAR_DEFAUT = config.regles as Record<CleRegle, Regle>;
export const VERSION_REGLES = config.version;
export const AVERTISSEMENT_REGLES = config.avertissement;

/** Fusionne les règles du fichier avec celles modifiées par l'utilisateur (page Règles). */
export function appliquerModifications(
  modifications: { cle: string; valeur: number; verifie_le?: string | null }[],
): Regles {
  const regles = structuredClone(REGLES_PAR_DEFAUT) as Regles;
  regles._modifiees = [];
  for (const m of modifications) {
    if (!(m.cle in regles) || !Number.isFinite(m.valeur)) continue;
    const cle = m.cle as CleRegle;
    regles[cle] = { ...regles[cle], valeur: m.valeur, a_verifier: false, verifie_le: m.verifie_le ?? regles[cle].verifie_le };
    regles._modifiees.push(cle);
  }
  return regles;
}

export const v = (regles: Regles, cle: CleRegle) => regles[cle].valeur;
