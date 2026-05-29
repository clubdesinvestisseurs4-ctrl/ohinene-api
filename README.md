# 🏨 Hôtel Ohinene — Application de Gestion Interne (PWA)

> Stack : **Vanilla JS + Express.js + Firebase Firestore**  
> Déploiement : **Vercel** (frontend) · **Render** (backend API) · **Firebase** (base de données)

---

## 📁 Structure du projet

```
RESI-OHINENE-APP/
├── client/                ← Frontend PWA (déployé sur Vercel)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── sw.js              ← Service Worker (offline support)
│   ├── manifest.json      ← PWA manifest
│   ├── vercel.json        ← Config Vercel
│   └── icons/             ← Icônes PWA (à créer)
├── server/                ← API Backend (déployé sur Render)
│   ├── server.js
│   ├── firebase-admin.js
│   ├── package.json
│   ├── render.yaml
│   ├── middleware/
│   │   └── auth.js
│   └── routes/
│       ├── auth.js
│       ├── chambres.js
│       ├── clients.js
│       ├── reservations.js
│       ├── factures.js
│       ├── stocks.js
│       └── stats.js
├── firestore.rules        ← Règles de sécurité Firestore
├── firestore.indexes.json ← Index Firestore
└── README.md
```

---

## ─── ÉTAPE 1 · FIREBASE (base de données) ────────────────────────────

### 1.1 Créer le projet Firebase

1. Aller sur **https://console.firebase.google.com**
2. Cliquer **Ajouter un projet** → Nom : `hotel-ohinene` → Continuer
3. Désactiver Google Analytics (optionnel) → **Créer le projet**

### 1.2 Activer Firestore

1. Dans le menu gauche → **Firestore Database** → **Créer une base de données**
2. Mode : **Production** → Région : `eur3 (europe-west)` → **Activer**

### 1.3 Générer la clé Admin SDK

1. ⚙️ Paramètres du projet → **Comptes de service**
2. Cliquer **Générer une nouvelle clé privée** → Télécharger le fichier JSON
3. Ouvrir le JSON, noter :
   - `project_id`
   - `client_email`
   - `private_key`

### 1.4 Déployer les règles et index Firestore

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Connexion
firebase login

# Depuis la racine du projet
firebase init firestore
# → Sélectionner le projet hotel-ohinene
# → Utiliser les fichiers existants (firestore.rules, firestore.indexes.json)

firebase deploy --only firestore:rules,firestore:indexes
```

---

## ─── ÉTAPE 2 · BACKEND SUR RENDER ───────────────────────────────────

### 2.1 Préparer le code

```bash
cd server
cp .env.example .env
# Éditer .env avec vos vraies valeurs Firebase
```

### 2.2 Tester en local d'abord

```bash
# Dans server/
npm install
npm run dev
# → http://localhost:3001/health doit retourner {"status":"ok"}
```

### 2.3 Pousser sur GitHub

```bash
cd ..  # racine du projet
git init
git add .
git commit -m "feat: Hotel Ohinene PWA - initial commit"
git remote add origin https://github.com/VOTRE_USER/hotel-ohinene.git
git push -u origin main
```

### 2.4 Déployer sur Render

1. Aller sur **https://render.com** → **New Web Service**
2. Connecter votre dépôt GitHub
3. Configuration :
   - **Name** : `hotel-ohinene-api`
   - **Root Directory** : `server`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Plan** : Free (ou Starter pour éviter le sleep)
4. Ajouter les variables d'environnement :

| Clé | Valeur |
|-----|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(générer : `openssl rand -base64 32`)* |
| `FIREBASE_PROJECT_ID` | votre-project-id |
| `FIREBASE_CLIENT_EMAIL` | firebase-adminsdk-xxx@... |
| `FIREBASE_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` |
| `CLIENT_URL` | `https://hotel-ohinene.vercel.app` |

5. Cliquer **Create Web Service** → attendre le déploiement (~3min)
6. Tester : `https://hotel-ohinene-api.onrender.com/health`

### 2.5 Initialiser les données (seed)

Une fois l'API déployée, appeler une seule fois :

```bash
# Créer les utilisateurs admin/manager/reception
curl -X POST https://hotel-ohinene-api.onrender.com/api/auth/seed

# Connexion pour obtenir un token
curl -X POST https://hotel-ohinene-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026!"}'
# → copier le token retourné

# Créer les 15 chambres (remplacer TOKEN)
curl -X POST https://hotel-ohinene-api.onrender.com/api/chambres/seed \
  -H "Authorization: Bearer TOKEN"

# Créer les stocks par défaut
curl -X POST https://hotel-ohinene-api.onrender.com/api/stocks/seed \
  -H "Authorization: Bearer TOKEN"
```

---

## ─── ÉTAPE 3 · FRONTEND SUR VERCEL ──────────────────────────────────

### 3.1 Mettre à jour l'URL API dans app.js

Ouvrir `client/app.js` ligne 8, remplacer :
```javascript
: 'https://hotel-ohinene-api.onrender.com/api';
```
par votre vraie URL Render.

### 3.2 Créer les icônes PWA

Créer 3 icônes PNG dans `client/icons/` :
- `icon-72.png`  (72×72 px)
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

> Utiliser https://favicon.io ou https://realfavicongenerator.net

### 3.3 Déployer sur Vercel

**Option A — Via interface Vercel :**
1. Aller sur **https://vercel.com** → **New Project**
2. Importer votre dépôt GitHub
3. **Root Directory** : `client`
4. **Framework** : `Other`
5. Build & Output settings → tout laisser vide
6. Cliquer **Deploy**

**Option B — Via CLI :**
```bash
npm install -g vercel
cd client
vercel --prod
# Suivre les instructions (Root = client, framework = Other)
```

4. L'URL sera : `https://hotel-ohinene.vercel.app`
5. Ajouter cette URL dans Render → variable `CLIENT_URL`

---

## ─── ÉTAPE 4 · TESTS ─────────────────────────────────────────────────

### 4.1 Tests locaux (développement)

```bash
# Terminal 1 – API
cd server && npm run dev

# Terminal 2 – Frontend (utiliser Live Server VS Code ou)
cd client && npx serve -p 5500
```

Ouvrir `http://localhost:5500`

### 4.2 Tests fonctionnels (checklist)

#### ✅ Authentification
- [ ] Login avec `admin` / `Admin@2026!` → Dashboard visible
- [ ] Login avec mauvais mot de passe → message d'erreur
- [ ] Logout → retour écran login
- [ ] Rafraîchir la page → rester connecté (token en localStorage)

#### ✅ Dashboard
- [ ] Stats : occupation, clients, revenus, alertes s'affichent
- [ ] Mini-grille des chambres visible avec couleurs statut
- [ ] Arrivées / départs du jour listés

#### ✅ Chambres
- [ ] Liste des 15 chambres visibles
- [ ] Filtres étage / statut / type fonctionnent
- [ ] Cliquer une chambre → modal détail
- [ ] Changer le statut → mise à jour visible

#### ✅ Réservations
- [ ] Créer une réservation → chambre passe en "réservée"
- [ ] Check-in → chambre passe en "occupée"
- [ ] Check-out → chambre passe en "nettoyage"
- [ ] Annulation → chambre libérée
- [ ] Filtrer par statut et date

#### ✅ Clients
- [ ] Créer un nouveau client
- [ ] Recherche par nom/téléphone fonctionne
- [ ] Modifier les infos d'un client

#### ✅ Facturation
- [ ] Les factures s'affichent après check-out
- [ ] Filtrer par plage de dates
- [ ] Bouton imprimer → aperçu facture

#### ✅ Stocks
- [ ] Liste des articles visibles
- [ ] Articles en alerte (quantité < minimum) surlignés en rouge
- [ ] Ajouter / modifier un article
- [ ] Panneau alertes mis à jour

#### ✅ Rapports
- [ ] Sélectionner une période → générer rapport
- [ ] Revenus totaux, nombre factures, panier moyen affichés
- [ ] Top clients classé par dépenses

#### ✅ PWA
- [ ] Chrome → URL bar → icône "installer l'application"
- [ ] Mobile → "Ajouter à l'écran d'accueil"
- [ ] Passer hors ligne → bannière orange visible
- [ ] Les pages déjà visitées restent accessibles hors ligne
- [ ] Lighthouse PWA score ≥ 90

### 4.3 Test PWA avec Lighthouse

1. Ouvrir l'app dans Chrome
2. F12 → Lighthouse → cocher **PWA** → **Analyser la page**
3. Score attendu : 90+ pour PWA

### 4.4 Test de l'API avec curl ou Postman

```bash
BASE=https://hotel-ohinene-api.onrender.com

# Health
curl $BASE/health

# Login
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Stats dashboard
curl -H "Authorization: Bearer $TOKEN" $BASE/api/stats/dashboard

# Liste chambres
curl -H "Authorization: Bearer $TOKEN" $BASE/api/chambres

# Créer un client
curl -X POST $BASE/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nom":"KOUASSI","prenom":"Jean","tel":"0102030405","email":"jean@test.com"}'
```

---

## ─── IDENTIFIANTS PAR DÉFAUT ────────────────────────────────────────

| Rôle | Username | Mot de passe |
|------|----------|-------------|
| Directeur | `admin` | `Admin@2026!` |
| Manager | `manager` | `Manager@2026!` |
| Réceptionniste | `reception` | `Reception@2026!` |

> ⚠️ **Changer ces mots de passe en production !**

---

## ─── ENDPOINTS API ───────────────────────────────────────────────────

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/seed` | Init utilisateurs (1 fois) |
| GET | `/api/stats/dashboard` | Stats temps réel |
| GET | `/api/stats/rapport` | Rapport financier |
| GET / PUT | `/api/chambres` | Gestion chambres |
| POST | `/api/chambres/seed` | Init 15 chambres |
| GET / POST / PUT | `/api/clients` | Gestion clients |
| GET | `/api/clients/search?q=` | Recherche clients |
| GET / POST / PUT | `/api/reservations` | Réservations + check-in/out |
| GET / POST | `/api/factures` | Facturation |
| GET / POST / PUT | `/api/stocks` | Stocks |
| GET | `/api/stocks/alerts` | Alertes stock bas |
| POST | `/api/stocks/seed` | Init stocks |
| GET | `/health` | Health check |

---

## ─── VARIABLES D'ENVIRONNEMENT ──────────────────────────────────────

```env
# server/.env
JWT_SECRET=chaine_aleatoire_securisee
FIREBASE_PROJECT_ID=hotel-ohinene-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@hotel-ohinene-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=3001
CLIENT_URL=https://hotel-ohinene.vercel.app
```

---

## ─── COMMANDES UTILES ───────────────────────────────────────────────

```bash
# Dev local
cd server && npm run dev

# Build check
cd server && node -e "require('./server.js')" && echo "OK"

# Vérifier la santé de l'API Render
curl https://hotel-ohinene-api.onrender.com/health

# Déployer les règles Firestore
firebase deploy --only firestore:rules

# Logs Render (via CLI)
render logs --service hotel-ohinene-api
```

---

## ─── TROUBLESHOOTING ─────────────────────────────────────────────────

| Problème | Solution |
|----------|----------|
| `CORS error` | Vérifier `CLIENT_URL` dans les variables Render |
| `Token invalide` | Vérifier que `JWT_SECRET` est le même en local et sur Render |
| `Firebase permission denied` | Vérifier `FIREBASE_PRIVATE_KEY` (les `\n` doivent être des vrais sauts de ligne) |
| `Render se rendort` (plan free) | Upgrade vers Starter (7$/mois) ou utiliser un ping cron |
| PWA n'installe pas | Vérifier `manifest.json` et que le site est en HTTPS |
| Chambre indisponible | Vérifier les dates et le statut dans Firestore Console |

---

*Développé pour l'Hôtel Ohinene – v1.0.0*
