# GoOrderly.ai - Setup Guide

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- PostgreSQL >= 14.x
- Google Cloud Project with APIs enabled

## Quick Start

### 1. Clone and Install

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb goorderly

# Or using psql
psql -U postgres
CREATE DATABASE goorderly;
\q
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database
DB_NAME=goorderly
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
JWT_SECRET=your_jwt_secret_here

# Template
TEMPLATE_DOC_ID=your_google_doc_template_id

# Frontend
FRONTEND_URL=http://localhost:3001

# Encryption (auto-generated if not set)
ENCRYPTION_KEY=your_32_character_encryption_key

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### 4. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Google Drive API
   - Google Docs API
   - Google Calendar API
   - Gmail API (optional)
4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - Copy Client ID and Secret to `.env`

### 5. Create Template Document

1. Create a Google Doc with your journal template
2. Share it with your Google account (or make it accessible)
3. Copy the document ID from the URL:
   - URL format: `https://docs.google.com/document/d/DOCUMENT_ID/edit`
   - Add `DOCUMENT_ID` to `.env` as `TEMPLATE_DOC_ID`

### 6. Initialize Database

```bash
npm run db:init
```

This will:
- Create database tables
- Sync Sequelize models
- Seed initial template

### 7. Start Development Servers

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### 8. Access Application

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

## Development Workflow

### Running Tests

```bash
# Watch mode
npm test

# Coverage
npm run test:coverage

# CI mode
npm run test:ci
```

### Database Operations

```bash
# Initialize database
npm run db:init

# Seed template
npm run db:seed
```

### Linting

```bash
# Check for issues
npm run lint

# Auto-fix
npm run lint:fix
```

## Project Structure

```
goorderly-ai/
├── src/                    # Backend source
│   ├── config/            # Configuration
│   ├── database/          # DB setup, migrations, seeders
│   ├── models/            # Sequelize models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   └── utils/             # Utilities
├── frontend/              # React frontend
│   └── src/
│       ├── components/    # React components
│       ├── pages/         # Page components
│       └── services/      # API client
├── tests/                 # Test files
├── docs/                  # Documentation
└── apps_script/           # Original Apps Script code
```

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check credentials in `.env`
- Ensure database exists: `psql -l | grep goorderly`

### OAuth Issues

- Verify redirect URI matches Google Cloud Console
- Check that APIs are enabled
- Ensure client ID/secret are correct

### Template Not Found

- Verify template document ID is correct
- Ensure template is accessible to your Google account
- Check template document exists and is not deleted

### Frontend Not Connecting

- Verify backend is running on port 3000
- Check `REACT_APP_API_URL` in frontend (or use proxy)
- Check CORS settings in backend

## Next Steps

1. Complete onboarding flow
2. Test voice logging
3. Set up cron jobs for automated journal creation
4. Deploy to production

## Production Deployment

See `DEPLOYMENT.md` for production deployment instructions.

