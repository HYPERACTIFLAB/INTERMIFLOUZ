# Intermiflouze

Application web installable (PWA) pour gérer une activité de réalisateur/photographe :
contrats d'intermittence (annexe 8), compteur d'heures, micro-entreprise, notes de
frais, devis/factures, finances et agenda.

- Architecture et modèle de données : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Captures d'écran de chaque étape : [`docs/captures/`](docs/captures/)

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 0 | Socle : connexion (code par e-mail), menu, installation PWA | ✅ |
| a | Contacts, contrats + import PDF intelligent | ✅ |
| b | Compteur d'heures, projection, récap d'actualisation, règles modifiables, objectif ARE | ✅ |
| c | Notes de frais avec scan + page d'accueil (tableau de bord) | ✅ |
| d | Micro-entreprise : devis/factures PDF numérotés, encaissements, déclarations URSSAF, plafonds | ✅ |
| e | Tableau de bord finances + simulateur | à venir |
| f | Google Agenda (agenda « Tournage » mis à jour automatiquement) | ✅ |

---

## Mise en route (une seule fois, ~30 minutes)

Tout ce qui suit est **gratuit**. Tu auras besoin de 4 comptes : GitHub (déjà fait),
Supabase, Google Cloud (ton compte Google habituel suffit) et Vercel.

### 1. Créer la base de données (Supabase)

1. Va sur <https://supabase.com> → **Start your project** → connecte-toi avec GitHub.
2. **New project** :
   - Name : `intermiflouze`
   - Database password : clique sur **Generate** et garde-le dans ton gestionnaire de mots de passe.
   - Region : **West EU (Paris)**.
   - Plan : **Free**.
3. Une fois le projet créé : **Project Settings → API Keys** (ou bouton **Connect**). Note :
   - le **Project URL** (`https://xxxx.supabase.co`)
   - la **Publishable key** (commence par `sb_publishable_`)

### 1 bis. Créer les tables (à refaire à chaque nouvelle étape)

Les tables de la base sont décrites dans le dossier [`supabase/migrations/`](supabase/migrations/),
un fichier par étape. Pour chaque fichier, **dans l'ordre**, et une seule fois :

1. Ouvre le fichier sur GitHub, clique sur l'icône **Copier** (« Copy raw file »).
2. Dans Supabase : menu **SQL Editor → New query**, colle, puis **Run**.
3. Le message « Success. No rows returned » confirme que c'est fait.

| Fichier | Étape |
|---|---|
| `20261011000001_etape_a_contrats.sql` | a : contacts, contrats, documents |
| `20261011000002_securite_rls_auto_enable.sql` | sécurité (option « automatic RLS ») |
| `20261011000003_etape_b_intermittence.sql` | b : situation d'intermittence, règles modifiées |
| `20261011000004_etape_c_frais_paiements.sql` | c : notes de frais, salaire perçu ou non |
| `20261011000005_objectif_are.sql` | objectif d'allocation journalière |
| `20261011000006_etape_f_agenda.sql` | f : connexion Google Agenda |
| `20261012000001_widget.sql` | widget iPhone (clé perso) |
| `20261023000001_etape_d_micro.sql` | d : micro-entreprise (devis, factures, encaissements, URSSAF) |

### 1 ter. Connexion

Par défaut, on se connecte avec **e-mail + mot de passe** (aucun réglage nécessaire). Le compte
est créé dans Supabase (**Authentication → Users → Add user**), avec un mot de passe
provisoire ; ajouter `{"doit_changer_mdp": true}` aux métadonnées oblige à en choisir un
nouveau à la première connexion. Le mot de passe se change ensuite dans **Plus → Changer mon
mot de passe**.

Option : connexion par code reçu par e-mail (variable `NEXT_PUBLIC_EMAIL_CODE_LOGIN=1`). Dans Supabase : **Authentication → Emails →
Magic link** (ou « Magic Link or OTP ») :

- **Subject** : `Ton code de connexion Intermiflouze`
- **Body** : colle le contenu de [`supabase/templates/magic_link.html`](supabase/templates/magic_link.html), puis **Save**.

La connexion avec Google (section suivante) est optionnelle : elle s'active en ajoutant la
variable `NEXT_PUBLIC_GOOGLE_LOGIN=1` une fois Google configuré.

### 2. (Optionnel) Autoriser « Se connecter avec Google » (Google Cloud)

1. Va sur <https://console.cloud.google.com> → en haut, **Sélectionner un projet → Nouveau projet** → nom `Intermiflouze`.
2. Menu **API et services → Écran de consentement OAuth** (ou « Google Auth Platform ») :
   - Type : **Externe**.
   - Nom de l'application : `Intermiflouze`, ton e-mail en contact.
   - **Utilisateurs test** : ajoute ton adresse Gmail.
   - Laisse l'application en mode **Test** (pas besoin de validation par Google pour un usage perso).
3. **API et services → Identifiants → Créer des identifiants → ID client OAuth** :
   - Type : **Application Web**.
   - **URI de redirection autorisés** : `https://xxxx.supabase.co/auth/v1/callback`
     (remplace `xxxx` par ton Project URL Supabase).
   - Valide, puis copie l'**ID client** et le **Code secret du client**.
4. Retour dans Supabase : **Authentication → Sign In / Providers → Google** :
   active-le, colle l'ID client et le code secret, enregistre.

### 3. Mettre l'appli en ligne (Vercel, gratuit)

L'appli est hébergée sur **Vercel** (offre Hobby, gratuite), reliée au dépôt GitHub : chaque envoi
sur la branche `master` est mis en ligne automatiquement. (Netlify a été abandonné : son offre
gratuite limite le nombre de mises en ligne par mois.)

1. Va sur <https://vercel.com> → **Sign up** → **Continue with GitHub** → offre **Hobby**.
2. **Add New… → Project** → à côté de `INTERMIFLOUZ`, **Import** (si le dépôt n'apparaît pas :
   **Adjust GitHub App Permissions** et autorise-le).
3. Project Name : `intermiflouze`. Ne touche à rien d'autre (Vercel reconnaît Next.js).
4. Ouvre **Environment Variables** et ajoute, une par une (**Add**) :

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ton Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ta Publishable key (`sb_publishable_…`) |
   | `ALLOWED_EMAILS` | ton adresse e-mail (seule personne autorisée) |
   | `ANTHROPIC_API_KEY` | ta clé Claude (facultatif, voir 3 bis) |

5. **Deploy** (si rien ne se publie, envoyer une modification sur `master` lance la première mise en ligne). Au bout de 1 à 2 minutes, Vercel affiche l'adresse, du type
   `https://intermiflouze.vercel.app`.

Pour changer une variable plus tard : **Settings → Environment Variables**, puis
**Deployments → ⋯ → Redeploy** (une nouvelle valeur n'est prise en compte qu'après une mise en ligne).

La lecture des documents tourne en tâche de fond (`/api/extraction`, jusqu'à 5 minutes sur l'offre Hobby).

### 3 bis. Activer la lecture automatique des documents (Claude, payant)

Optionnel : sans clé Claude, l'import fonctionne quand même, mais tu remplis la fiche à la main.

1. Crée un compte sur <https://console.anthropic.com> (différent d'un abonnement Claude).
2. **Settings → Billing** : ajoute ta carte et achète du crédit (prépayé, en dollars).
   Laisse **Auto reload désactivé** : tu ne pourras jamais dépenser plus que ton crédit.
3. **Settings → API Keys → Create Key**, nomme-la `intermiflouze`, copie-la (elle ne s'affiche qu'une fois).
4. Dans Vercel : **Settings → Environment Variables** → clé `ANTHROPIC_API_KEY`, colle la clé, **Save**.
5. **Deployments → ⋯ → Redeploy** : une nouvelle valeur n'est prise en compte qu'après une mise en ligne.

Attention : la liste des clés de Claude Console n'affiche qu'un aperçu tronqué. La clé complète
ne s'affiche qu'une fois, à sa création (bouton **Copier**). Une erreur « 401 » signifie que la
clé collée est incomplète ou désactivée.

Coût estimé : 2 à 5 centimes de dollar par document (modèle Claude Opus 5.5). L'appli affiche
la dépense du mois en bas de la page Contrats. Quand le crédit est épuisé, l'appli le signale
et tu continues en saisie manuelle.

### 3 ter. Google Agenda (gratuit, une fois, depuis l'ordinateur)

L'appli crée son propre agenda « Tournage » dans ton Google Agenda et y met tes
jours de tournage. Elle n'a accès qu'à cet agenda-là : elle ne peut ni lire ni modifier les autres.

1. Va sur <https://console.cloud.google.com> (avec ton compte Gmail) → en haut, **Sélectionner un
   projet → Nouveau projet** → nom `Intermiflouze` → **Créer**, puis sélectionne-le.
2. Barre de recherche en haut : tape **Google Calendar API** → ouvre-la → **Activer**.
3. Menu ☰ → **API et services → Écran de consentement OAuth** (ou « Google Auth Platform ») →
   **Commencer** :
   - Nom de l'application : `Intermiflouze` ; e-mail d'assistance : ton adresse.
   - Audience : **Externe**.
   - Coordonnées : ton adresse. Accepte les conditions → **Créer**.
4. Dans **Audience → Utilisateurs test** : ajoute ton adresse Gmail. L'application reste en mode
   **Test** : Google coupe alors l'accès 7 jours après chaque connexion. L'appli prévient la veille
   sur l'accueil ; il suffit d'appuyer sur « Reconnecter » (Agenda). Publier l'application
   (« En production ») supprimerait cette limite, mais Google demande alors de compléter le branding
   (page d'accueil, règles de confidentialité : `https://intermiflouze.vercel.app/confidentialite`).
5. Dans **Clients** (ou « Identifiants ») → **Créer un client** :
   - Type d'application : **Application Web** ; nom : `Intermiflouze`.
   - **URI de redirection autorisés** → **Ajouter un URI** :
     `https://intermiflouze.vercel.app/api/google/callback` (ton adresse Vercel)
   - **Créer**. Une fenêtre affiche l'**ID client** et le **Code secret du client**.
6. Dans Vercel : **Settings → Environment Variables** :
   - `GOOGLE_CLIENT_ID` : l'ID client (se termine par `.apps.googleusercontent.com`).
   - `GOOGLE_CLIENT_SECRET` : le code secret.
7. **Deployments → ⋯ → Redeploy**, puis dans l'appli : **Agenda → Connecter Google Agenda**.
   Google affiche « Application non validée » : **Paramètres avancés → Accéder à Intermiflouze**,
   puis coche la case de l'agenda et **Continuer**.

Ensuite, chaque contrat enregistré, complété ou supprimé est mis à jour tout seul dans Google
(un événement « journée entière » par série de jours travaillés). Le jeton Google est chiffré en base
(AES-256-GCM, clé dérivée du code secret client). Changer le code secret oblige à reconnecter Google.

### 3 quater. Widget iPhone (gratuit)

Avec l'appli gratuite **Scriptable** (App Store) : dans Intermiflouze, **Plus → Widget iPhone**, suis
les 5 étapes affichées. Le script contient une clé perso (seule son empreinte est gardée en base) ;
recréer un script désactive l'ancien.

### 4. Installer l'appli

- **iPhone** : ouvre ton adresse Vercel dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**.
- **Mac / PC (Chrome ou Edge)** : icône d'installation à droite de la barre d'adresse.
- **Mac (Safari)** : menu **Fichier → Ajouter au Dock**.

---

## Pour les développeurs : lancer en local

Prérequis : Node.js 20 ou plus.

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev                  # http://localhost:3000
```

Base de données locale (nécessite Docker) : `npx supabase start`, puis copie dans
`.env.local` l'URL et la clé « publishable » affichées. Les tables sont créées
automatiquement. En développement, la page de connexion propose aussi une connexion
par mot de passe (utilisateurs créés avec `npx supabase` ou l'API d'administration locale).

Sans `.env.local`, l'appli démarre en **mode démo** (interface visible, rien
n'est enregistré, connexion désactivée). Ce mode n'existe qu'en local : une fois
déployée, l'appli exige toujours une connexion.

Commandes utiles : `npm run lint`, `npm run build`, `npm test` (tests des calculs).

La micro-entreprise (`lib/micro/`) suit ces principes : le chiffre d'affaires est celui **encaissé**
(paiements notés sur les factures, ou recettes sans facture) ; une facture reçoit son numéro
(`F-2026-001`, suite continue sans trou) seulement quand elle est émise, et ne se modifie plus
ensuite ; la première déclaration URSSAF regroupe les mois jusqu'à la fin du 4e mois qui suit
le début d'activité, puis c'est chaque mois. Les PDF sont générés côté serveur (`pdf-lib`,
`/api/pdf/devis|facture/[id]`).

Les règles de calcul (seuils, formule de l'allocation…) sont dans `config/regles.json`, chacune avec sa
source et sa date de vérification. Le moteur de calcul est dans `lib/regles/` (testé dans
`lib/regles/intermittence.test.ts` et `lib/regles/objectif.test.ts`). La page « Objectif ARE »
cherche, par dichotomie, le nombre d'heures (au salaire horaire choisi) qui donne l'allocation visée.

### Organisation du code

```
app/(app)/       Pages de l'appli (protégées par la connexion)
app/connexion/   Page de connexion Google
app/auth/        Retour de Google, déconnexion
components/      Éléments d'interface
lib/             Logique (Supabase, configuration, navigation)
lib/extraction/  Lecture des documents par Claude (schéma des champs, coût)
lib/google/      Google Agenda : connexion, chiffrement du jeton, envoi des contrats
supabase/        Tables et règles de sécurité (migrations SQL)
proxy.ts         Vérifie la connexion avant chaque page
public/sw.js     Service worker (installation, page hors ligne)
```

### Sécurité

- Toutes les pages exigent une session Supabase valide **et** un e-mail présent dans `ALLOWED_EMAILS`.
- Les clés secrètes (Claude, Google Agenda) ne sont jamais préfixées `NEXT_PUBLIC_` : elles restent sur le serveur.
- Le service worker ne met aucune donnée personnelle en cache.
- Chaque table a une règle RLS « je ne vois que mes lignes » ; les fichiers sont dans un stockage privé,
  rangés par utilisateur, et affichés via des liens valables 10 minutes.
