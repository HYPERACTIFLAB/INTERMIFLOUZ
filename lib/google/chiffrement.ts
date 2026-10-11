import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { googleIdentifiants } from "./config";

/**
 * Le jeton Google est chiffré en AES-256-GCM avant d'aller en base.
 * La clé est dérivée du secret client Google (jamais stocké en base) :
 * une fuite de la base seule ne permet pas d'accéder à l'agenda.
 */
function cle() {
  return Buffer.from(hkdfSync("sha256", googleIdentifiants().secret, "intermiflouze", "jeton-google", 32));
}

export function chiffrer(texte: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const donnees = Buffer.concat([c.update(texte, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), donnees.toString("base64")].join(".");
}

export function dechiffrer(chiffre: string) {
  const [version, iv, tag, donnees] = chiffre.split(".");
  if (version !== "v1") throw new Error("Format de jeton inconnu.");
  const d = createDecipheriv("aes-256-gcm", cle(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(donnees, "base64")), d.final()]).toString("utf8");
}
