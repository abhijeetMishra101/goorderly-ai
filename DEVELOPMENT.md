# GoOrderly.ai - Development Setup

## Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- Google Cloud Project with APIs enabled

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

### 3. Set Up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API, Google Docs API, Google Calendar API
4. Create OAuth 2.0 credentials
5. Add redirect URIs
6. Copy Client ID and Secret to `.env`

### 4. Get Template Document ID
1. Create your journal template in Google Docs
2. Copy the document ID from the URL
3. Add to `.env` as `TEMPLATE_DOC_ID`

### 5. Run Tests
```bash
npm test
```

### 6. Start Development Server
```bash
npm run dev
```

## Test-Driven Development

### Writing Tests First
1. Write failing test in `tests/` directory
2. Run test: `npm test`
3. Implement minimal code to pass
4. Refactor if needed
5. Repeat

### Test Structure
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`

## Project Structure

```
src/
├── services/          # Business logic services
├── utils/            # Utility functions
├── routes/           # API routes
├── middleware/       # Express middleware
├── app.js           # Express app setup
└── index.js         # Entry point

tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
└── e2e/             # E2E tests
```

## Next Steps

1. ✅ Set up TDD infrastructure
2. ✅ Create test suites
3. ✅ Implement core services
4. ⏳ Add Google OAuth integration
5. ⏳ Add database (Firestore)
6. ⏳ Deploy to Cloud Run

