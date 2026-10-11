import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ContratExtractionSchema, type ContratExtraction } from "./contrat-schema";
import { EXTRACTION_MODEL, estimateCostUsd, type SupportedMime } from "./config";

const SYSTEM = `Tu lis des documents administratifs français d'un technicien intermittent du spectacle (annexe 8) : contrats de travail (CDDU), fiches de paie, attestations employeur mensuelles (AEM).
Extrais uniquement ce qui figure dans le document. N'invente rien : si une information est absente, mets valeur à null et confiance à "basse".
Les dates sont au format AAAA-MM-JJ. Les montants sont en euros, avec un point décimal.
Pour une fiche de paie, les dates sont celles de la période travaillée, et les heures sont celles déclarées pour cette période.
Si le document indique des cachets plutôt que des heures, renseigne cachets et laisse heures à null.`;

export type ExtractionResult = {
  extraction: ContratExtraction;
  modele: string;
  tokensEntree: number;
  tokensSortie: number;
  coutUsd: number;
};

export class ExtractionError extends Error {}

export async function extraireContrat(file: Buffer, mime: SupportedMime): Promise<ExtractionResult> {
  // trim : un espace ou un retour à la ligne collé avec la clé la rend invalide.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
  const data = file.toString("base64");

  const fichier: Anthropic.Beta.BetaContentBlockParam =
    mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mime, data } };

  let message;
  try {
    const stream = client.beta.messages.stream({
      model: EXTRACTION_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ContratExtractionSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [fichier, { type: "text", text: "Extrais les informations de ce document." }],
        },
      ],
    });
    message = await stream.finalMessage();
  } catch (error) {
    // Détail technique (code HTTP, identifiant de requête) pour pouvoir diagnostiquer.
    const detail =
      error instanceof Anthropic.APIError ? ` [${error.status ?? "?"} ${error.requestID ?? ""}]`.replace(" ]", "]") : "";
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ExtractionError(
        "La clé API Claude est refusée : vérifie qu'elle est active dans Claude Console et recopiée en entier dans ANTHROPIC_API_KEY." + detail,
      );
    } else if (error instanceof Anthropic.RateLimitError) {
      throw new ExtractionError("Trop de demandes en même temps. Réessaie dans une minute." + detail);
    } else if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.PermissionDeniedError) {
      throw new ExtractionError(
        "Claude a refusé la demande. Vérifie que ton crédit Claude n'est pas épuisé (Claude Console → Billing) et que le fichier est lisible." +
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
  if (message.stop_reason === "max_tokens" || !message.parsed_output) {
    throw new ExtractionError("La lecture du document n'a pas abouti. Réessaie ou saisis le contrat à la main.");
  }

  return {
    extraction: message.parsed_output,
    modele: message.model,
    tokensEntree,
    tokensSortie,
    coutUsd: estimateCostUsd(message.model, tokensEntree, tokensSortie),
  };
}
