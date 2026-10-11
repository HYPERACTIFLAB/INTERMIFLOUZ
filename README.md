# Intermiflouze

Application web installable (PWA) pour gérer une activité de réalisateur/photographe :
contrats d'intermittence (annexe 8), compteur d'heures, micro-entreprise, notes de
frais, devis/factures, finances et agenda.

- Architecture et modèle de données : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Captures d'écran de chaque étape : [`docs/captures/`](docs/captures/)

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 0 | Socle : connexion Google, menu, installation PWA | ✅ |
| a | Contrats + import PDF intelligent | à venir |
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

### 2. Autoriser « Se connecter avec Google » (Google Cloud)

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

### 3. Mettre l'appli en ligne (Vercel)

1. Va sur <https://vercel.com> → **Sign up** avec GitHub → offre **Hobby** (gratuite).
2. **Add New → Project** → importe le dépôt `INTERMIFLOUZ`.
3. Avant de cliquer sur **Deploy**, ouvre **Environment Variables** et ajoute :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ton Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ta Publishable key |
   | `ALLOWED_EMAILS` | ton adresse Gmail (seule personne autorisée) |

4. **Deploy**. Vercel te donne une adresse du type `https://intermiflouz.vercel.app`.
5. Retour dans Supabase : **Authentication → URL Configuration** :
   - **Site URL** : ton adresse Vercel.
   - **Redirect URLs** : ajoute `https://ton-adresse.vercel.app/**` et `http://localhost:3000/**`.

Ensuite, chaque modification envoyée sur GitHub est mise en ligne automatiquement.

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
proxy.ts         Vérifie la connexion avant chaque page
public/sw.js     Service worker (installation, page hors ligne)
```

### Sécurité

- Toutes les pages exigent une session Supabase valide **et** un e-mail présent dans `ALLOWED_EMAILS`.
- Les clés secrètes (Claude, Google Agenda…) ne seront jamais préfixées `NEXT_PUBLIC_` : elles restent sur le serveur.
- Le service worker ne met aucune donnée personnelle en cache.
