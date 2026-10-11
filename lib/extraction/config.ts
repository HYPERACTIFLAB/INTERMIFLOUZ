/**
 * Réglages de la lecture automatique des documents par Claude.
 * Tarifs : https://platform.claude.com/docs/en/about-claude/pricing (relevés le 2026-10-11).
 */
export const EXTRACTION_MODEL = "claude-opus-5-5";

/** Prix en dollars par million de tokens, pour estimer le coût de chaque lecture. */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { entree: number; sortie: number }> = {
  "claude-opus-5-5": { entree: 4, sortie: 20 },
  "claude-opus-4-8": { entree: 5, sortie: 25 },
  "claude-haiku-5-5": { entree: 0.1, sortie: 0.5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const price = MODEL_PRICES_USD_PER_MTOK[model] ?? MODEL_PRICES_USD_PER_MTOK[EXTRACTION_MODEL];
  return (inputTokens * price.entree + outputTokens * price.sortie) / 1_000_000;
}

/** Formats acceptés par Claude. */
export const SUPPORTED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type SupportedMime = (typeof SUPPORTED_MIME)[number];

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function extractionEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
