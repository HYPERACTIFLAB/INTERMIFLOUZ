import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { ContratExtraction } from "./contrat-schema";
import { ClaudeContratFormat, normaliser, type ClaudeContrat } from "./claude-format";
import { EXTRACTION_MODEL, estimateCostUsd, type SupportedMime } from "./config";

const SYSTEM = `Tu lis des documents administratifs français d'un technicien intermittent du spectacle (annexe 8) : contrats de travail (CDDU), fiches de paie, attestations employeur mensuelles (AEM).
Extrais uniquement ce qui figure dans le document. N'invente rien : si une information est absente, laisse le champ vide (""). Liste dans champs_incertains les champs lus avec un doute ou déduits.
Les dates sont au format AAAA-MM-JJ. Les montants sont en euros, avec un point décimal.
Pour une fiche de paie, les dates sont celles de la période travaillée, et les heures sont celles déclarées pour cette période.
Si le document indique des cachets plutôt que des heures, renseigne cachets et laisse heures vide.`;

export type ExtractionResult = {
  extraction: ContratExtraction;
  modele: string;
  tokensEntree: number;
  tokensSortie: number;
  coutUsd: number;
};

export class ExtractionError extends Error {}

const CONSIGNE_JSON = `Réponds uniquement par un objet JSON, sans texte autour, avec exactement ces clés :
type_document ("contrat" | "fiche_paie" | "aem" | "autre"), employeur_nom, employeur_siret, employeur_numero_objet,
employeur_adresse, projet, poste, annexe ("8" | "10" | "regime_general" | "inconnue"), date_debut, date_fin,
jours_travailles, heures, cachets, salaire_brut, salaire_net (tous des chaînes, "" si absent),
champs_incertains (tableau de noms de champs), remarques (chaîne).`;

/** Extrait et valide l'objet JSON d'une réponse texte. */
function lireJson(content: Anthropic.Beta.BetaContentBlock[]): ClaudeContrat | null {
  const texte = content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  try {
    const r = ClaudeContratFormat.safeParse(JSON.parse(texte.slice(debut, fin + 1)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export async function extraireContrat(file: Buffer, mime: SupportedMime): Promise<ExtractionResult> {
  // trim : un espace ou un retour à la ligne collé avec la clé la rend invalide.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
  const data = file.toString("base64");

  const fichier: Anthropic.Beta.BetaContentBlockParam =
    mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mime, data } };

  const demander = (avecFormat: boolean) =>
    client.beta.messages
      .stream({
        model: EXTRACTION_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: avecFormat
          ? { effort: "medium", format: betaZodOutputFormat(ClaudeContratFormat) }
          : { effort: "medium" },
        system: avecFormat ? SYSTEM : SYSTEM + "\n\n" + CONSIGNE_JSON,
        messages: [
          {
            role: "user",
            content: [fichier, { type: "text", text: "Extrais les informations de ce document." }],
          },
        ],
      })
      .finalMessage();

  let message;
  let parsed: ClaudeContrat | null = null;
  try {
    try {
      message = await demander(true);
      parsed = message.parsed_output;
    } catch (error) {
      // Schéma refusé par l'API : on redemande sans format imposé, en JSON libre.
      if (!(error instanceof Anthropic.BadRequestError) || !/grammar|schema/i.test(error.message)) throw error;
      message = await demander(false);
      parsed = lireJson(message.content);
    }
  } catch (error) {
    // Détail technique (code HTTP, identifiant de requête) pour pouvoir diagnostiquer.
    // Message renvoyé par l'API (ex. crédit insuffisant), sans donnée sensible.
    const apiMessage =
      error instanceof Anthropic.APIError
        ? ((error.error as { error?: { message?: string } } | undefined)?.error?.message ?? "").slice(0, 200)
        : "";
    const detail =
      error instanceof Anthropic.APIError
        ? ` [${error.status ?? "?"} ${error.requestID ?? ""}${apiMessage ? " : " + apiMessage : ""}]`
        : "";
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ExtractionError(
        "La clé API Claude est refusée : vérifie qu'elle est active dans Claude Console et recopiée en entier dans ANTHROPIC_API_KEY." + detail,
      );
    } else if (error instanceof Anthropic.RateLimitError) {
      throw new ExtractionError("Trop de demandes en même temps. Réessaie dans une minute." + detail);
    } else if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.PermissionDeniedError) {
      throw new ExtractionError(
        "Claude a refusé la demande (crédit épuisé, fichier illisible ou demande invalide)." +
          detail,
      );
    } else if (error instanceof Anthropic.APIError) {
      throw new ExtractionError("Le service Claude est momentanément indisponible. Réessaie plus tard." + detail);
    }
    throw error;
  }

  const tokensEntree =
    message.usage.input_tokens +
    (message.usage.cache_creation_input_tokens ?? 0) +
    (message.usage.cache_read_input_tokens ?? 0);
  const tokensSortie = message.usage.output_tokens;

  if (message.stop_reason === "refusal") {
    throw new ExtractionError("Claude n'a pas pu traiter ce document. Saisis le contrat à la main.");
  }
  if (message.stop_reason === "max_tokens" || !parsed) {
    throw new ExtractionError("La lecture du document n'a pas abouti. Réessaie ou saisis le contrat à la main.");
  }

  return {
    extraction: normaliser(parsed),
    modele: message.model,
    tokensEntree,
    tokensSortie,
    coutUsd: estimateCostUsd(message.model, tokensEntree, tokensSortie),
  };
}
