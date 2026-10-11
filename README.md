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
| b | Compteur d'heures + récap d'actualisation | à venir |
| c | Notes de frais avec scan | à venir |
| d | Micro-entreprise + devis/factures | à venir |
| e | Tableau de bord finances + simulateur | à venir |
| f | Google Agenda | à venir |

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

### 3. Mettre l'appli en ligne

L'appli est hébergée sur **Netlify** (projet `intermiflouze`, adresse
<https://intermiflouze.netlify.app>), relié au dépôt GitHub : chaque envoi sur la branche
`master` est mis en ligne automatiquement. Les variables d'environnement sont réglées dans
**Project configuration → Environment variables** (mêmes noms que ci-dessous).

Alternative équivalente : Vercel.

1. Va sur <https://vercel.com> → **Sign up** avec GitHub → offre **Hobby** (gratuite).
2. **Add New → Project** → importe le dépôt `INTERMIFLOUZ`.
3. Avant de cliquer sur **Deploy**, ouvre **Environment Variables** et ajoute :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ton Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ta Publishable key |
   | `ALLOWED_EMAILS` | ton adresse e-mail (seule personne autorisée) |

4. **Deploy**. Vercel te donne une adresse du type `https://intermiflouz.vercel.app`.
5. Retour dans Supabase : **Authentication → URL Configuration** :
   - **Site URL** : ton adresse Vercel.
   - **Redirect URLs** : ajoute `https://ton-adresse.vercel.app/**` et `http://localhost:3000/**`.

Ensuite, chaque modification envoyée sur GitHub est mise en ligne automatiquement.

### 3 bis. Activer la lecture automatique des documents (Claude, payant)

Optionnel : sans clé Claude, l'import fonctionne quand même, mais tu remplis la fiche à la main.

1. Crée un compte sur <https://console.anthropic.com> (différent d'un abonnement Claude).
2. **Settings → Billing** : ajoute ta carte et achète du crédit (prépayé, en dollars).
   Laisse **Auto reload désactivé** : tu ne pourras jamais dépenser plus que ton crédit.
3. **Settings → API Keys → Create Key**, nomme-la `intermiflouze`, copie-la (elle ne s'affiche qu'une fois).
4. Dans Vercel : **Settings → Environment Variables** → ajoute `ANTHROPIC_API_KEY` avec cette clé,
   puis **Deployments → ⋯ → Redeploy**.

Coût estimé : 2 à 5 centimes de dollar par document (modèle Claude Opus 5.5). L'appli affiche
la dépense du mois en bas de la page Contrats. Quand le crédit est épuisé, l'appli le signale
et tu continues en saisie manuelle.

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

Commandes utiles : `npm run lint`, `npm run build`.

### Organisation du code

```
app/(app)/       Pages de l'appli (protégées par la connexion)
app/connexion/   Page de connexion Google
app/auth/        Retour de Google, déconnexion
components/      Éléments d'interface
lib/             Logique (Supabase, configuration, navigation)
lib/extraction/  Lecture des documents par Claude (schéma des champs, coût)
supabase/        Tables et règles de sécurité (migrations SQL)
proxy.ts         Vérifie la connexion avant chaque page
public/sw.js     Service worker (installation, page hors ligne)
```

### Sécurité

- Toutes les pages exigent une session Supabase valide **et** un e-mail présent dans `ALLOWED_EMAILS`.
- Les clés secrètes (Claude, Google Agenda…) ne seront jamais préfixées `NEXT_PUBLIC_` : elles restent sur le serveur.
- Le service worker ne met aucune donnée personnelle en cache.
- Chaque table a une règle RLS « je ne vois que mes lignes » ; les fichiers sont dans un stockage privé,
  rangés par utilisateur, et affichés via des liens valables 10 minutes.
