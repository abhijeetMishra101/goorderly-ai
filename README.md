# GoOrderly.ai

> AI-powered voice journaling and reflection assistant for disciplined professionals

## 🎯 Overview

GoOrderly.ai helps you maintain structured daily reflection through automated journal creation, voice-powered activity logging, and intelligent analytics. Built for people who value intentional time management and consistent self-reflection.

## ✨ Features

### Current Implementation
- ✅ **Google OAuth Authentication** - Secure login with Google account
- ✅ **Template Selection** - Choose from available journal templates
- ✅ **User Preferences** - Customize journal folder name and creation time
- ✅ **Daily Journal Creation** - Automatically creates journals in Google Drive
- ✅ **Voice Logging** - Log activities via voice entry
- ✅ **User-Specific Templates** - Each user has their own template selection
- ✅ **Google Drive Integration** - All journals stored in user's Drive
- ✅ **Calendar Integration** - Auto-creates calendar events for journaling

### Planned Features
- 🚧 **Scheduled Journal Creation** - Automated daily journal creation via cron
- 🚧 **Email Notifications** - Reminders and summaries
- 🚧 **Analytics Dashboard** - Visual insights and trends
- 🚧 **Weekly/Monthly Reports** - Aggregated summaries with charts
- 🚧 **AI Summaries** - LLM-powered daily reflection summaries

## 🚀 Quick Start

See [SETUP.md](./SETUP.md) for detailed installation instructions.

### Prerequisites
- Node.js >= 18.x
- PostgreSQL >= 14.x
- Google Cloud Project with APIs enabled

### Installation
```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Initialize database
npm run db:init

# Start development servers
npm run dev        # Backend (port 3000)
cd frontend && npm start  # Frontend (port 3001)
```

## 📁 Project Structure

```
goorderly-ai/
├── src/                    # Backend source code
│   ├── config/            # Configuration files
│   ├── database/          # Database setup & migrations
│   ├── models/            # Sequelize models
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic services
│   ├── middleware/        # Express middleware
│   └── utils/             # Utility functions
├── frontend/              # React frontend application
│   └── src/
│       ├── components/    # Reusable components
│       ├── pages/         # Page components
│       └── services/      # API client
├── tests/                 # Test files
├── docs/                  # Documentation
└── apps_script/           # Original Google Apps Script code
```

## 🔧 Configuration

See [.env.example](./.env.example) for all required environment variables.

Key variables:
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `TEMPLATE_DOC_ID` - Google Doc template ID
- `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database credentials

## 📊 API Documentation

### Authentication
- `GET /api/auth/google` - Initiate OAuth flow
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Templates
- `GET /api/templates` - List all active templates
- `GET /api/templates/:id` - Get template details

### Onboarding
- `GET /api/onboarding/status` - Check onboarding status
- `POST /api/onboarding/select-template` - Select template
- `POST /api/onboarding/confirm` - Confirm and save preferences

### Journals
- `GET /api/journal/:date` - Get journal for date
- `POST /api/journal/create` - Create new journal
- `POST /api/journal/voice-entry` - Log voice entry

## 🧪 Testing

```bash
# Run tests
npm test

# Coverage report
npm run test:coverage

# CI mode
npm run test:ci
```

## 📚 Documentation

- [Setup Guide](./SETUP.md) - Installation and configuration
- [Architecture Diagram](./docs/architecture-diagram.md) - System architecture
- [User Workflow](./docs/user-workflow-diagram.md) - User journey
- [Development Guide](./DEVELOPMENT.md) - Development workflow
- [Context](./CONTEXT.md) - Project background

## 🛣️ Roadmap

See [roadmap.md](./roadmap.md) for detailed development phases.

## 🔒 Security

- Encrypted refresh tokens
- JWT authentication
- User-specific OAuth tokens
- Protected API routes
- CORS configuration

## 📝 License

MIT

## 🤝 Contributing

This is currently a personal project. Contributions welcome once codebase is open-sourced.

## 📧 Support

For issues or questions, please open an issue in the repository.

---

Built with ❤️ for disciplined professionals who value intentional living.
