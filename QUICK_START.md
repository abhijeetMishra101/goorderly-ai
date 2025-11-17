# 🚀 Guide de Démarrage Rapide - Tests OAuth

Ce guide vous aidera à démarrer rapidement les tests OAuth pour GoOrderly.ai.

## ✅ Prérequis

1. **Node.js** (version 18+)
2. **PostgreSQL** (version 12+)
3. **Compte Google Cloud** avec les APIs activées

## 📋 Étapes de Configuration

### 1. Installer les dépendances

```bash
# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 2. Configurer PostgreSQL

```bash
# Créer la base de données
createdb goorderly

# Ou avec psql
psql -U postgres -c "CREATE DATABASE goorderly;"
```

### 3. Configurer Google OAuth

1. **Créer un projet Google Cloud:**
   - Aller sur https://console.cloud.google.com/
   - Créer un nouveau projet ou sélectionner un existant

2. **Activer les APIs:**
   - Google Drive API
   - Google Docs API
   - Google Calendar API
   - Google OAuth2 API

3. **Créer OAuth Credentials:**
   - APIs & Services > Credentials
   - Create Credentials > OAuth client ID
   - Type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - Copier Client ID et Client Secret

4. **Créer le template Google Doc:**
   - Créer un nouveau Google Doc avec votre template de journal
   - Copier l'ID depuis l'URL: `https://docs.google.com/document/d/DOCUMENT_ID/edit`

### 4. Créer le fichier .env

Créer un fichier `.env` à la racine du projet:

```env
# Database
DB_NAME=goorderly
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# Google OAuth
GOOGLE_CLIENT_ID=votre_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
JWT_SECRET=changez_cette_cle_secrete_en_production

# Template
TEMPLATE_DOC_ID=votre_google_doc_template_id

# Frontend
FRONTEND_URL=http://localhost:3001

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

**⚠️ Important:** Remplacez toutes les valeurs par vos propres credentials!

### 5. Initialiser la base de données

```bash
npm run db:init
```

Cette commande va:
- Créer les tables dans PostgreSQL
- Synchroniser les modèles Sequelize
- Insérer le template initial

## 🎯 Lancer l'application

### Terminal 1 - Backend:
```bash
npm run dev
```

Vous devriez voir:
```
✓ Database connected
✓ GoOrderly.ai API server running on port 3000
✓ Health check: http://localhost:3000/health
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm start
```

Le frontend démarrera sur http://localhost:3001

## 🧪 Tester le flux OAuth

1. **Ouvrir le navigateur:** http://localhost:3001
2. **Cliquer sur "Continue with Google"**
3. **Autoriser l'application** dans Google OAuth
4. **Vous serez redirigé** vers la sélection de template
5. **Sélectionner un template**
6. **Confirmer les préférences** (nom du dossier, heure)
7. **Accéder au dashboard** et tester les fonctionnalités

## 🔍 Tests API manuels

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

## 🐛 Dépannage

### Erreur de connexion à la base de données
- Vérifier que PostgreSQL est démarré: `pg_isready`
- Vérifier les credentials dans `.env`
- Vérifier que la base existe: `psql -l | grep goorderly`

### Erreur OAuth "redirect_uri_mismatch"
- Vérifier que le redirect URI dans `.env` correspond EXACTEMENT à celui dans Google Cloud Console
- Format: `http://localhost:3000/api/auth/google/callback`
- Pas de slash final, pas de http://localhost:3001

### Erreur OAuth "invalid_client"
- Vérifier que GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont corrects
- Vérifier que les APIs sont activées dans Google Cloud Console

### Frontend ne se connecte pas au backend
- Vérifier que le backend tourne sur le port 3000
- Vérifier les CORS dans `src/app.js`
- Vérifier le proxy dans `frontend/package.json`

### Erreur "Template not found"
- Vérifier que `npm run db:init` a été exécuté
- Vérifier que le template existe dans la base: `psql goorderly -c "SELECT * FROM templates;"`

## 📝 Checklist de test

- [ ] Backend démarre sans erreur
- [ ] Frontend démarre sans erreur
- [ ] Connexion à la base de données réussie
- [ ] OAuth redirect fonctionne
- [ ] Callback OAuth reçoit le token
- [ ] Utilisateur créé dans la base de données
- [ ] JWT token stocké dans localStorage
- [ ] Redirection vers template selection
- [ ] Sélection de template fonctionne
- [ ] Confirmation d'onboarding fonctionne
- [ ] Dashboard accessible après onboarding

## 🎉 Prochaines étapes

Une fois OAuth fonctionnel:
1. Tester la création de journal quotidien
2. Tester l'ajout d'entrées vocales
3. Tester l'intégration Google Drive
4. Configurer les cron jobs pour l'automatisation

## 📚 Documentation

- Guide complet: `OAUTH_TESTING.md`
- Setup complet: `SETUP.md`
- Architecture: `docs/architecture-diagram.md`
- Workflow: `docs/user-workflow-diagram.md`

