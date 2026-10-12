/**
 * Script du widget pour l'appli iPhone « Scriptable », prêt à coller.
 * La clé perso est insérée dedans : le script ne doit être montré qu'à son propriétaire.
 */
export function scriptWidget(appUrl: string, cle: string) {
  return `// Intermiflouze : widget pour Scriptable (petit ou moyen format).
// Ce script contient ta clé perso : ne le partage pas.
const APP = ${JSON.stringify(appUrl)};
const CLE = ${JSON.stringify(cle)};

const ACCENT = new Color("#4fb3b0");
const ORANGE = new Color("#e8913a");
const TEXTE = Color.dynamic(new Color("#1c1c1a"), new Color("#ededea"));
const DISCRET = Color.dynamic(new Color("#6b6b66"), new Color("#9a9a94"));
const FOND = Color.dynamic(new Color("#f7f7f5"), new Color("#121211"));

const fm = FileManager.local();
const cache = fm.joinPath(fm.cacheDirectory(), "intermiflouze-widget.json");

async function charger() {
  try {
    const req = new Request(APP + "/api/widget");
    req.headers = { Authorization: "Bearer " + CLE };
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (req.response.statusCode !== 200) return { erreur: data.erreur || "Erreur " + req.response.statusCode };
    fm.writeString(cache, JSON.stringify(data));
    return data;
  } catch (e) {
    // Pas de réseau : on réaffiche les derniers chiffres connus.
    if (fm.fileExists(cache)) return JSON.parse(fm.readString(cache));
    return { erreur: "Pas de connexion" };
  }
}

const euros = (n) => String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, "\\u202f") + " €";
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dateCourte = (iso) => { const [, m, j] = iso.split("-"); return Number(j) + " " + MOIS[Number(m) - 1]; };

function texte(pile, contenu, taille, couleur, gras) {
  const t = pile.addText(contenu);
  t.font = gras ? Font.boldSystemFont(taille) : Font.systemFont(taille);
  t.textColor = couleur || TEXTE;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

function barre(pile, part, largeur) {
  const ctx = new DrawContext();
  ctx.size = new Size(largeur, 6);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const fond = new Path();
  fond.addRoundedRect(new Rect(0, 0, largeur, 6), 3, 3);
  ctx.addPath(fond);
  ctx.setFillColor(new Color("#888888", 0.3));
  ctx.fillPath();
  const plein = new Path();
  plein.addRoundedRect(new Rect(0, 0, Math.max(6, largeur * Math.min(1, part)), 6), 3, 3);
  ctx.addPath(plein);
  ctx.setFillColor(ACCENT);
  ctx.fillPath();
  const img = pile.addImage(ctx.getImage());
  img.imageSize = new Size(largeur, 6);
}

function blocHeures(pile, d, largeur) {
  texte(pile, "HEURES", 10, DISCRET, true);
  pile.addSpacer(2);
  const ligne = pile.addStack();
  ligne.bottomAlignContent();
  texte(ligne, String(d.heures), 26, TEXTE, true);
  texte(ligne, " / " + d.seuil + " h", 13, DISCRET);
  pile.addSpacer(4);
  barre(pile, d.heures / d.seuil, largeur);
  pile.addSpacer(3);
  texte(pile, d.atteint ? "Seuil atteint" : "Il manque " + d.manquant + " h" + (d.date_limite ? " · " + dateCourte(d.date_limite) : ""), 10, DISCRET);
}

function blocAre(pile, d) {
  texte(pile, d.are && d.are.si507 ? "ARE SI 507 H" : "ARE ESTIMÉE", 10, DISCRET, true);
  pile.addSpacer(1);
  texte(pile, d.are ? d.are.montant.toFixed(2).replace(".", ",") + " €/j" : "—", 18, ACCENT, true);
}

function ligneInfo(pile, libelle, valeur, alerte) {
  const l = pile.addStack();
  l.centerAlignContent();
  texte(l, libelle, 11, DISCRET);
  l.addSpacer();
  texte(l, valeur, 12, alerte ? ORANGE : TEXTE, true);
}

const d = await charger();
const w = new ListWidget();
w.backgroundColor = FOND;
w.url = APP;
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
w.setPadding(14, 14, 14, 14);
const famille = config.widgetFamily || "medium";

if (d.erreur) {
  texte(w, "Intermiflouze", 12, DISCRET, true);
  w.addSpacer(4);
  const t = w.addText(d.erreur);
  t.font = Font.systemFont(12);
  t.textColor = ORANGE;
} else if (famille === "small") {
  blocHeures(w, d, 120);
  w.addSpacer();
  blocAre(w, d);
} else {
  const cols = w.addStack();
  const gauche = cols.addStack();
  gauche.layoutVertically();
  blocHeures(gauche, d, 130);
  gauche.addSpacer();
  blocAre(gauche, d);
  cols.addSpacer(16);
  const droite = cols.addStack();
  droite.layoutVertically();
  ligneInfo(droite, "À percevoir", euros(d.a_percevoir), d.a_percevoir > 0);
  droite.addSpacer(6);
  ligneInfo(droite, "AEM manquantes", String(d.aem_manquantes), d.aem_manquantes > 0);
  droite.addSpacer();
  if (d.prochain) {
    texte(droite, d.prochain.en_cours ? "EN COURS" : "PROCHAIN TOURNAGE", 9, DISCRET, true);
    texte(droite, d.prochain.titre, 12, TEXTE, true);
    texte(droite, dateCourte(d.prochain.debut) + (d.prochain.fin !== d.prochain.debut ? " → " + dateCourte(d.prochain.fin) : ""), 10, DISCRET);
  } else {
    texte(droite, "Pas de tournage prévu", 10, DISCRET);
  }
}

if (config.runsInWidget) Script.setWidget(w);
else if (famille === "small") await w.presentSmall();
else await w.presentMedium();
Script.complete();
`;
}
