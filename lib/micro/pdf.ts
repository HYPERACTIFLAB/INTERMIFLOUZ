import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Client, Entreprise } from "@/lib/data/micro";
import { montantLigne, type Ligne } from "./calcul";

export type DonneesPdf = {
  type: "devis" | "facture";
  numero: string | null;
  entreprise: Entreprise;
  client: Client;
  objet: string | null;
  dateEmission: string | null;
  dateLimite: string | null;
  lignes: Ligne[];
  total: number;
  notes: string | null;
};

const GRIS = rgb(0.42, 0.42, 0.4);
const NOIR = rgb(0.1, 0.1, 0.1);
const FOND = rgb(0.95, 0.95, 0.94);
const A4 = { l: 595.28, h: 841.89 };
const MARGE = 50;

/** Les polices standard du PDF ne connaissent pas certains caractères (espaces fines, flèches…). */
function propre(texte: string, police: PDFFont) {
  const t = texte.replace(/\r/g, "").replace(/[\u00a0\u202f\u2009]/g, " ").replace(/→/g, "->");
  return [...t].map((c) => {
    try {
      police.encodeText(c);
      return c;
    } catch {
      return "?";
    }
  }).join("");
}

const euros = (c: number) =>
  (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
const date = (iso: string) => iso.split("-").reverse().join("/");
const nombre = (n: number) => String(n).replace(".", ",");

/** Coupe un texte en lignes qui tiennent dans la largeur donnée. */
function couper(texte: string, police: PDFFont, taille: number, largeur: number) {
  const lignes: string[] = [];
  for (const paragraphe of texte.split(/\r?\n/)) {
    let courante = "";
    for (const mot of paragraphe.split(" ")) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur || !courante) courante = essai;
      else {
        lignes.push(courante);
        courante = mot;
      }
    }
    lignes.push(courante);
  }
  return lignes;
}

/** Devis ou facture au format A4, avec les mentions obligatoires d'un micro-entrepreneur. */
export async function genererPdf(d: DonneesPdf) {
  const pdf = await PDFDocument.create();
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grasse = await pdf.embedFont(StandardFonts.HelveticaBold);
  const titre = d.type === "devis" ? "Devis" : "Facture";
  pdf.setTitle(`${titre} ${d.numero ?? "brouillon"}`);
  pdf.setAuthor(d.entreprise.nom ?? "");
  pdf.setCreator("Intermiflouze");

  let page: PDFPage = pdf.addPage([A4.l, A4.h]);
  let y = A4.h - MARGE;

  const ecrire = (texte: string, x: number, opts: { taille?: number; gras?: boolean; couleur?: ReturnType<typeof rgb>; droite?: boolean } = {}) => {
    const police = opts.gras ? grasse : normale;
    const taille = opts.taille ?? 10;
    const t = propre(texte, police);
    const px = opts.droite ? x - police.widthOfTextAtSize(t, taille) : x;
    page.drawText(t, { x: px, y, size: taille, font: police, color: opts.couleur ?? NOIR });
  };
  const nouvellePageSiBesoin = (hauteur: number) => {
    if (y - hauteur < MARGE + 40) {
      page = pdf.addPage([A4.l, A4.h]);
      y = A4.h - MARGE;
    }
  };

  // En-tête : émetteur à gauche, type et numéro à droite.
  const e = d.entreprise;
  const yHaut = y;
  const emetteur = [
    [e.nom_commercial ?? e.nom ?? "", true],
    [e.nom_commercial && e.nom ? e.nom : "", false],
    [e.activite ?? "", false],
    ...(e.adresse ?? "").split(/\r?\n/).map((l) => [l, false] as const),
    [e.siret ? `SIRET ${e.siret}` : "", false],
    [e.email ?? "", false],
    [e.telephone ?? "", false],
  ].filter(([t]) => t) as [string, boolean][];
  for (const [t, gras] of emetteur) {
    ecrire(t, MARGE, { gras, taille: gras ? 12 : 10 });
    y -= gras ? 16 : 13;
  }
  const yGauche = y;
  y = yHaut;
  ecrire(titre.toUpperCase(), A4.l - MARGE, { gras: true, taille: 20, droite: true });
  y -= 22;
  ecrire(d.numero ?? "BROUILLON", A4.l - MARGE, { gras: true, taille: 11, droite: true });
  y -= 15;
  if (d.dateEmission) {
    ecrire(`Date : ${date(d.dateEmission)}`, A4.l - MARGE, { droite: true });
    y -= 13;
  }
  if (d.dateLimite) {
    ecrire(`${d.type === "devis" ? "Valable jusqu'au" : "Échéance"} : ${date(d.dateLimite)}`, A4.l - MARGE, { droite: true });
    y -= 13;
  }
  y = Math.min(y, yGauche) - 20;

  // Client, dans un encadré à droite.
  const c = d.client;
  const lignesClient = c ? [c.nom, ...(c.adresse ?? "").split(/\r?\n/), c.siret ? `SIRET ${c.siret}` : ""].filter(Boolean) : ["Client non renseigné"];
  const hClient = 22 + lignesClient.length * 13;
  const xClient = A4.l - MARGE - 230;
  page.drawRectangle({ x: xClient, y: y - hClient + 12, width: 230, height: hClient, color: FOND });
  ecrire(d.type === "devis" ? "POUR" : "FACTURÉ À", xClient + 10, { taille: 8, couleur: GRIS });
  y -= 15;
  lignesClient.forEach((t, i) => {
    ecrire(t, xClient + 10, { gras: i === 0 });
    y -= 13;
  });
  y -= 20;

  if (d.objet) {
    for (const l of couper(`Objet : ${d.objet}`, normale, 10, A4.l - 2 * MARGE)) {
      ecrire(l, MARGE);
      y -= 13;
    }
    y -= 8;
  }

  // Tableau des prestations.
  const col = { qte: A4.l - MARGE - 230, pu: A4.l - MARGE - 90, montant: A4.l - MARGE };
  const largeurDesignation = col.qte - MARGE - 70;
  const entete = () => {
    ecrire("DÉSIGNATION", MARGE, { taille: 8, couleur: GRIS });
    ecrire("QTÉ", col.qte, { taille: 8, couleur: GRIS, droite: true });
    ecrire("PRIX UNIT.", col.pu, { taille: 8, couleur: GRIS, droite: true });
    ecrire("MONTANT", col.montant, { taille: 8, couleur: GRIS, droite: true });
    y -= 6;
    page.drawLine({ start: { x: MARGE, y }, end: { x: A4.l - MARGE, y }, thickness: 0.8, color: GRIS });
    y -= 14;
  };
  entete();
  for (const l of d.lignes) {
    const texte = couper(l.description, normale, 10, largeurDesignation);
    nouvellePageSiBesoin(texte.length * 13 + 10);
    const yLigne = y;
    texte.forEach((t) => {
      ecrire(t, MARGE);
      y -= 13;
    });
    const yFin = y;
    y = yLigne;
    ecrire(`${nombre(l.quantite)} ${l.unite}`.trim(), col.qte, { droite: true });
    ecrire(euros(l.prix_unitaire), col.pu, { droite: true });
    ecrire(euros(montantLigne(l)), col.montant, { droite: true });
    y = yFin - 4;
    page.drawLine({ start: { x: MARGE, y: y + 8 }, end: { x: A4.l - MARGE, y: y + 8 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
  }

  // Total.
  nouvellePageSiBesoin(60);
  y -= 10;
  page.drawLine({ start: { x: col.qte - 40, y: y + 12 }, end: { x: A4.l - MARGE, y: y + 12 }, thickness: 1.2, color: NOIR });
  ecrire("TOTAL", col.qte - 40, { gras: true, taille: 12 });
  ecrire(euros(d.total), col.montant, { gras: true, taille: 12, droite: true });
  y -= 15;
  ecrire(e.mention_tva, col.montant, { taille: 8, couleur: GRIS, droite: true });
  y -= 25;

  if (d.notes) {
    for (const l of couper(d.notes, normale, 10, A4.l - 2 * MARGE)) {
      nouvellePageSiBesoin(13);
      ecrire(l, MARGE);
      y -= 13;
    }
    y -= 10;
  }

  // Mentions de bas de page.
  const mentions =
    d.type === "facture"
      ? [e.conditions_paiement, e.iban ? `IBAN ${e.iban}${e.bic ? ` - BIC ${e.bic}` : ""}` : "", e.penalites_retard]
      : ["Devis à retourner signé, précédé de la mention « Bon pour accord ».", "", "Date et signature :"];
  nouvellePageSiBesoin(80);
  page.drawLine({ start: { x: MARGE, y: y + 8 }, end: { x: A4.l - MARGE, y: y + 8 }, thickness: 0.3, color: GRIS });
  y -= 6;
  for (const m of mentions.filter((x, i) => x || (d.type === "devis" && i === 1))) {
    for (const l of couper(m, normale, 8, A4.l - 2 * MARGE)) {
      ecrire(l, MARGE, { taille: 8, couleur: GRIS });
      y -= 11;
    }
    y -= 3;
  }

  return pdf.save();
}
