# Intermiflouze — Architecture et modèle de données

> Validée le 11/10/2026 : stack, connexion Google ; micro-entreprise artisanale (photo, NAF 7420Z, BIC
> prestations de services), déclaration URSSAF mensuelle, franchise de TVA, versement libératoire,
> sans ACRE, active depuis le 12/08/2026.

---

## 1. Vue d'ensemble

```
 iPhone / Mac / PC  (PWA installée, interface en français)
        │  HTTPS
        ▼
 ┌─────────────────────────────────────────────┐
 │  Next.js (hébergé sur Vercel)               │
 │  ├─ Pages (React) : ce que tu vois          │
 │  └─ Routes serveur : le seul endroit qui    │
 │     connaît les clés secrètes               │
 │       • /api/extract   → API Claude         │
 │       • /api/google/*  → Google Agenda      │
 │       • /api/pdf/*     → génération PDF     │
 └───────────────┬─────────────────────────────┘
                 │
     ┌───────────┼─────────────────┐
     ▼           ▼                 ▼
 Supabase     API Claude        Google Agenda
 • Base Postgres  (extraction     (OAuth, synchro
 • Connexion       des PDF et      des contrats)
 • Fichiers        des photos)
   (PDF, photos)
```

Règle d'or : **le navigateur ne voit jamais une clé API**. Il parle à Next.js, et
c'est Next.js (côté serveur) qui appelle Claude, Google ou les fonctions
d'administration de Supabase.

---

## 2. La stack, et pourquoi

| Brique | Choix | Pourquoi (en clair) |
|---|---|---|
| Application | **Next.js 16 (App Router) + TypeScript** | Une seule base de code pour l'interface *et* le serveur. TypeScript attrape beaucoup d'erreurs avant qu'elles n'arrivent chez toi. Très documenté, facile à faire maintenir par quelqu'un d'autre. |
| Base, connexion, fichiers | **Supabase** | Trois besoins en un seul service : base de données Postgres (solide, exportable), authentification (e-mail + lien magique, ou Google), stockage de fichiers privé. Les règles **RLS** (Row Level Security) garantissent au niveau de la base que chaque ligne n'est lisible que par son propriétaire. Offre gratuite suffisante pour un usage perso, données hébergeables en Europe. |
| Hébergement | **Vercel** | Déploiement automatique à chaque modification poussée sur GitHub, HTTPS inclus. (Alternative équivalente si tu préfères : Netlify.) |
| Style | **Tailwind CSS + composants shadcn/ui** | Interface sobre et lisible, pensée mobile d'abord, mode sombre facile. |
| PWA | Manifeste + petit service worker maison (`public/sw.js`) | Pas de dépendance en plus. Rend l'appli installable sur iPhone (« Ajouter à l'écran d'accueil ») et sur ordinateur, avec icône et lancement plein écran. |
| Extraction IA | **API Claude (SDK officiel `@anthropic-ai/sdk`)**, modèle `claude-opus-5-5` | Claude lit nativement les PDF et les photos. On utilise les *structured outputs* : Claude renvoie un JSON qui respecte exactement notre format, avec un indice de confiance par champ. Coût estimé : quelques centimes par document. |
| Formulaires | **React Hook Form + Zod** | Le même schéma Zod valide le formulaire, la réponse de Claude et les données en base. |
| Graphiques | **Recharts** | Simple, responsive. |
| PDF générés (devis, factures, exports) | **@react-pdf/renderer** | Mise en page des factures en code, rendu identique partout. |
| Dates | **date-fns** (locale `fr`) | Calculs de périodes de 12 mois, formats français. |
| Règles de calcul | **Fichier `config/regles.json`** (+ copie éditable en base) | Voir §4. |

Ce que j'ai écarté :
- **Appli native iOS** : deux bases de code, App Store, coût — inutile pour ton usage.
- **Firebase** : base NoSQL, moins adaptée aux calculs (sommes d'heures par période, CA par mois) et aux exports.
- **Tout en local dans le navigateur** : pas de synchro entre iPhone et ordinateur, risque de perte.

### Coûts mensuels attendus
- Supabase : 0 € (offre gratuite : 500 Mo de base, 1 Go de fichiers). ~25 $/mois si tu dépasses.
- Vercel : 0 € (offre Hobby).
- Claude : **payant à l'usage, pas d'offre gratuite** (crédit prépayé). Seul poste payant. L'import intelligent est optionnel : sans clé Claude, la saisie manuelle fonctionne.
- Google Agenda : gratuit.

---

## 3. Sécurité et données sensibles

- **Connexion obligatoire** sur toutes les pages (`proxy.ts`, l'ancien « middleware » de Next.js), via « Se connecter avec Google ». Seuls les e-mails listés dans `ALLOWED_EMAILS` sont acceptés.
- **RLS Supabase** : chaque table a une colonne `user_id` et une règle « je ne vois que mes lignes ». Même en cas de bug dans l'appli, la base refuse.
- **Fichiers** dans un bucket Supabase **privé** ; l'appli génère des liens temporaires (valables quelques minutes) pour les afficher.
- **Clés secrètes** (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`) uniquement dans les variables d'environnement du serveur, jamais préfixées `NEXT_PUBLIC_`.
- **Jeton Google** chiffré en base (AES-GCM, clé dans une variable d'environnement).
- **Extraction IA** : le document est envoyé à Claude pour lecture uniquement, rien n'est enregistré sans ta validation.
- **Export complet** (CSV + PDF + archive des fichiers) disponible à tout moment : tes données ne sont jamais prisonnières.

---

## 4. Les règles de calcul modifiables

Toutes les valeurs « métier » vivent dans `config/regles.json`, jamais dans le code.
Chaque règle porte sa **valeur**, sa **source**, sa **date de vérification** et sa
**période de validité**. Une page « Règles » dans l'appli permet de les consulter
et de les modifier (la version modifiée est stockée en base et prime sur le
fichier ; un bouton permet de revenir aux valeurs du fichier).

Extrait (les valeurs seront vérifiées une par une à l'étape b, avec toi) :

```json
{
  "version": "2026-10",
  "intermittence_annexe8": {
    "seuil_heures": {
      "valeur": 507, "unite": "heures",
      "periode_reference_jours": 365,
      "description": "Heures à justifier sur les 12 mois précédant la fin de contrat",
      "source": "Règlement d'assurance chômage, annexe VIII",
      "url": "https://www.unedic.org/...",
      "verifie_le": "2026-10-11",
      "valide_du": "2016-08-01", "valide_au": null
    },
    "equivalence_cachet": { "valeur": 12, "unite": "heures", "...": "..." },
    "taux_journalier": {
      "formule": "A + B + C",
      "AJ_minimale": { "valeur": null, "a_verifier": true },
      "A": { "coef_sr_tranche1": 0.42, "seuil_sr": 13700, "coef_sr_tranche2": 0.05, "diviseur": 5000 },
      "B": { "coef_nht_tranche1": 0.26, "seuil_nht": 720, "coef_nht_tranche2": 0.08, "diviseur": 507 },
      "C": { "coef": 0.40 },
      "plancher": { "valeur": null, "a_verifier": true },
      "plafond":  { "valeur": null, "a_verifier": true }
    },
    "franchises": { "conges_payes": { "...": "..." }, "salaires": { "...": "..." }, "delai_attente_jours": 7 }
  },
  "micro_entreprise": {
    "categorie": "BIC prestations de services (artisan, NAF 7420Z)",
    "date_debut_activite": "2026-08-12",
    "plafond_ca_prestations": { "valeur": null, "a_verifier": true },
    "seuil_franchise_tva": { "valeur": null, "a_verifier": true },
    "taux_cotisations": { "valeur": null, "a_verifier": true },
    "versement_liberatoire": { "actif": true, "taux": null, "a_verifier": true },
    "contribution_formation_pro": { "valeur": null, "a_verifier": true },
    "periodicite_declaration": "mensuelle",
    "franchise_tva": true,
    "acre": false
  }
}
```

Le moteur de calcul (`lib/regles/`) lit ces valeurs et produit toujours un
résultat **accompagné du détail du calcul** et des sources utilisées, pour que tu
puisses vérifier. Le simulateur est un outil d'estimation, pas un calcul officiel
France Travail — ce sera écrit clairement dans l'appli.

---

## 5. Modèle de données

Toutes les tables ont : `id` (uuid), `user_id` (propriétaire, RLS), `created_at`,
`updated_at`. Montants en **centimes** (entiers, pas d'erreurs d'arrondi).

```
 organisations ──< contacts
      │  │  │
      │  │  └──────────────< devis ──< lignes_document
      │  │                    │
      │  └──< factures ──< lignes_document
      │          └──< paiements
      │
      └──< contrats ──< documents (PDF contrat, fiche de paie, AEM)
              │  └──< evenements_agenda
              └──< notes_de_frais ──< documents (justificatif)
 projets ─── relie contrats, notes de frais, devis, factures
 periodes_indemnisation, versements_are, declarations_urssaf, regles_override
```

### organisations (sociétés de production, clients)
| Champ | Type | Note |
|---|---|---|
| nom | texte | |
| type | `employeur` / `client` / `les_deux` | |
| siret, numero_objet (n° Congés Spectacles), adresse, email, telephone | texte | |
| notes | texte | |

### contacts (interlocuteurs)
`organisation_id`, prenom, nom, fonction, email, telephone, notes.

### projets
nom (ex. « Clip X », « Documentaire Y »), organisation_id, date_debut, date_fin, notes.

### contrats (intermittence)
| Champ | Type | Note |
|---|---|---|
| organisation_id, contact_id, projet_id | liens | employeur, interlocuteur, projet |
| poste | texte | ex. « Chef opérateur » |
| type_contrat | `cddu` / `autre` | |
| annexe | `8` / `10` / `regime_general` | 8 par défaut |
| date_debut, date_fin | date | |
| jours_travailles | liste de dates | utile pour l'agenda et l'actualisation |
| heures | décimal | |
| cachets | entier | converti en heures selon la règle configurée |
| heures_retenues | calculé | heures + cachets × équivalence |
| salaire_brut, salaire_net | centimes | |
| statut_aem | `a_recevoir` / `recue` / `transmise` | + date_reception_aem |
| statut | `brouillon` / `valide` | « brouillon » tant que tu n'as pas validé l'import |
| source | `manuel` / `import_ia` | |
| champs_incertains | JSON | liste des champs que Claude a signalés |
| notes | texte | |

### documents (tous les fichiers)
| Champ | Type | Note |
|---|---|---|
| type | `contrat` / `fiche_paie` / `aem` / `justificatif` / `devis_pdf` / `facture_pdf` / `autre` | |
| chemin_stockage, nom_fichier, mime, taille | | fichier dans le bucket privé |
| contrat_id / note_frais_id / facture_id / devis_id | liens (optionnels) | |
| extraction_brute | JSON | réponse complète de Claude (traçabilité) |
| extraction_statut | `aucune` / `en_cours` / `a_valider` / `validee` / `erreur` | |

### periodes_indemnisation
date_ouverture (fin de contrat de référence), date_anniversaire, heures_retenues,
salaire_reference, taux_journalier, statut (`en_cours` / `cloturee`), notes.
Sert à calculer la nouvelle période de référence et la jauge.

### versements_are
mois, montant_brut, montant_net, jours_indemnises, periode_id.

### notes_de_frais
date, marchand, montant_ttc, tva, devise, categorie (`transport`, `repas`,
`hebergement`, `materiel`, `location_materiel`, `logiciel`, `autre`…),
moyen_paiement, refacturable_a (`employeur` / `client` / `aucun`),
organisation_id, projet_id, contrat_id, statut (`a_rembourser` /
`rembourse` / `non_remboursable`), date_remboursement, champs_incertains, notes.

### devis / factures (micro-entreprise)
| Champ | Type | Note |
|---|---|---|
| numero | texte | auto : `D-2026-001`, `F-2026-001` — séquence continue sans trou, gérée en base |
| organisation_id, contact_id, projet_id | liens | |
| date_emission, date_validite (devis) / date_echeance (facture) | date | |
| objet | texte | |
| total_ht | centimes | somme des lignes |
| mention_tva | texte | ex. « TVA non applicable, art. 293 B du CGI » (configurable) |
| statut devis | `brouillon` / `envoye` / `accepte` / `refuse` / `expire` | |
| statut facture | `brouillon` / `envoyee` / `payee` / `en_retard` / `annulee` | « en retard » calculé automatiquement |
| devis_id (facture) | lien | facture créée depuis un devis |
| conditions_paiement, penalites_retard | texte | mentions légales |

`lignes_document` : document_id, ordre, description, quantite, unite, prix_unitaire.
`paiements` : facture_id, date, montant, moyen. **Le CA micro = somme des
paiements encaissés** (régime micro : on déclare à l'encaissement).

### declarations_urssaf
periode (mois ou trimestre), ca_declare, cotisations, date_limite, statut
(`a_faire` / `faite`), date_declaration.

### evenements_agenda
contrat_id, google_event_id, google_calendar_id, derniere_synchro.
`connexions_google` : jeton d'accès chiffré, agenda cible.

### parametres / regles_override
Infos de ton entreprise (SIRET, adresse, IBAN pour les factures), préférences,
et les règles modifiées depuis l'appli.

---

## 6. L'import PDF intelligent — comment ça marche

1. Tu déposes un PDF (ou prends une photo depuis l'iPhone).
2. Le fichier part directement dans le stockage privé Supabase.
3. Le serveur Next.js le récupère et l'envoie à Claude avec un schéma strict
   (champs attendus + pour chacun : `valeur`, `confiance` haute/moyenne/basse,
   `extrait_source`).
4. L'appli affiche un formulaire pré-rempli, avec le PDF à côté. Les champs à
   confiance basse ou absents sont **surlignés en orange**.
5. Tu corriges si besoin, tu valides → la fiche passe de `brouillon` à `valide`,
   le PDF reste rattaché.

L'employeur est rapproché automatiquement d'une organisation existante (par SIRET
ou par nom) ; sinon l'appli propose de la créer.

---

## 7. Organisation du code

```
intermiflouze/
├─ app/                    Pages et routes serveur (Next.js)
│  ├─ (auth)/connexion
│  ├─ (app)/contrats, intermittence, frais, micro, finances, agenda, contacts, regles
│  └─ api/extract, api/google, api/export
├─ components/             Éléments d'interface réutilisables
├─ lib/
│  ├─ regles/              Moteur de calcul (lit config/regles.json) + tests
│  ├─ extraction/          Appels à Claude + schémas
│  ├─ supabase/            Accès base
│  └─ export/              CSV et PDF
├─ config/regles.json      Règles de calcul (modifiables)
├─ supabase/migrations/    Création des tables + règles RLS (versionnées)
├─ public/                 Icônes, manifeste PWA
└─ README.md
```

Les calculs d'intermittence auront des **tests automatiques** (cas concrets
vérifiés à la main), pour qu'une modification de règle ne casse rien en silence.

---

## 8. Plan de construction

| Étape | Contenu | Ce que tu pourras tester |
|---|---|---|
| 0 | Socle : projet, connexion, PWA, navigation, Supabase | Te connecter, installer l'appli sur l'iPhone |
| a | Contacts (base) + Contrats + import PDF | Déposer un vrai contrat et le voir pré-rempli |
| b | Compteur 507 h, projection, récap d'actualisation | Voir ta jauge et ton récap du mois |
| c | Notes de frais avec scan | Photographier un ticket |
| d | Micro-entreprise : CA, URSSAF, devis/factures PDF | Créer et exporter une facture |
| e | Tableau de bord + simulateur de taux | Simuler l'ajout d'un contrat |
| f | Google Agenda | Voir un contrat apparaître dans ton agenda |
| — | README, exports CSV/PDF complets | Déployer seul |
