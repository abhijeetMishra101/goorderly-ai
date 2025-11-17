# Guide de Test OAuth - GoOrderly.ai

## Étape 1: Installation des dépendances

```bash
# Installer les dépendances backend
npm install

# Installer les dépendances frontend
cd frontend
npm install
cd ..
```

## Étape 2: Configuration PostgreSQL

### Option A: Installer PostgreSQL (si pas déjà installé)

**macOS (avec Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Télécharger depuis https://www.postgresql.org/download/windows/

### Créer la base de données

```bash
# Créer la base de données
createdb goorderly

# Ou avec psql
psql -U postgres
CREATE DATABASE goorderly;
\q
```

## Étape 3: Configuration Google OAuth

### 3.1 Créer un projet Google Cloud

1. Aller sur https://console.cloud.google.com/
2. Créer un nouveau projet ou sélectionner un projet existant
3. Activer les APIs suivantes:
   - Google Drive API
   - Google Docs API
   - Google Calendar API
   - Google OAuth2 API

### 3.2 Créer les credentials OAuth

1. Aller dans "APIs & Services" > "Credentials"
2. Cliquer sur "Create Credentials" > "OAuth client ID"
3. Type d'application: "Web application"
4. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
5. Copier le Client ID et Client Secret

### 3.3 Créer le document template

1. Créer un Google Doc avec le template de journal
2. Copier l'ID du document depuis l'URL:
   - Format: `https://docs.google.com/document/d/DOCUMENT_ID/edit`
   - Copier `DOCUMENT_ID`

## Étape 4: Configuration du fichier .env

Créer un fichier `.env` à la racine du projet:

```bash
# Database Configuration
DB_NAME=goorderly
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID=votre_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
JWT_SECRET=changez_cette_cle_secrete_en_production

# Template Configuration
TEMPLATE_DOC_ID=votre_google_doc_template_id

# Frontend Configuration
FRONTEND_URL=http://localhost:3001

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

**Important:** Remplacer les valeurs par vos propres credentials!

## Étape 5: Initialiser la base de données

```bash
npm run db:init
```

Cette commande va:
- Créer les tables
- Synchroniser les modèles Sequelize
- Insérer le template initial

## Étape 6: Démarrer les serveurs

### Terminal 1 - Backend:
```bash
npm run dev
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm start
```

## Étape 7: Tester le flux OAuth

1. Ouvrir http://localhost:3001 dans le navigateur
2. Cliquer sur "Continue with Google"
3. Autoriser l'application dans Google
4. Vous serez redirigé vers la sélection de template
5. Sélectionner un template
6. Confirmer les préférences
7. Accéder au dashboard

## Tests API manuels

### Test health endpoint:
```bash
curl http://localhost:3000/health
```

### Test templates (public):
```bash
curl http://localhost:3000/api/templates
```

### Test OAuth (démarre le flux):
```bash
# Ouvrir dans le navigateur:
open http://localhost:3000/api/auth/google
```

## Dépannage

### Erreur de connexion à la base de données
- Vérifier que PostgreSQL est démarré: `pg_isready`
- Vérifier les credentials dans `.env`
- Vérifier que la base existe: `psql -l | grep goorderly`

### Erreur OAuth
- Vérifier que le redirect URI correspond exactement dans Google Cloud Console
- Vérifier que les APIs sont activées
- Vérifier que Client ID et Secret sont corrects

### Frontend ne se connecte pas au backend
- Vérifier que le backend tourne sur le port 3000
- Vérifier les CORS dans `src/app.js`
- Vérifier le proxy dans `frontend/package.json`

