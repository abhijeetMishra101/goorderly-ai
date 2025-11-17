# GoOrderly.ai - New Architecture Plan

## 🏗️ Architecture Overview

### Core Principle: Decentralized Automation
Instead of running cron jobs on a centralized server, each user gets their own Google Apps Script that runs independently on their Google Drive. This approach:
- ✅ No server costs for scheduled tasks
- ✅ Better privacy (user's script runs in their account)
- ✅ More reliable (Google handles scheduling)
- ✅ Easier to scale (each user is independent)

## 📐 Architecture Components

### 1. Node.js/Express API (Centralized)
**Purpose**: User management, authentication, voice logging, LLM processing

**Responsibilities**:
- Google OAuth authentication
- User onboarding and template selection
- Creating Apps Script on user's Drive
- Voice entry processing with LLM
- API for voice logging web app

**Services**:
- `GoogleAuthService` - OAuth token management
- `GoogleDriveService` - Drive/Docs/Calendar API
- `GoogleAppsScriptService` - Create/manage user Apps Scripts
- `LLMService` - Self-hosted LLM integration (M1 Mac)
- `JournalService` - Voice entry processing
- `UserOnboardingService` - Template selection flow

### 2. Google Apps Script (Per User, Decentralized)
**Purpose**: Automated scheduled tasks for each user

**Location**: Created on user's Google Drive

**Responsibilities**:
- Daily journal creation at configured time
- Hourly reminder checks
- Daily/weekly/monthly analysis
- Email notifications

**Configuration** (Injected during creation):
- Template document ID
- Journal folder name
- Journal creation time (hour/minute)
- User email
- LLM API endpoint (for voice logging webhook)

### 3. Self-Hosted LLM (M1 Mac)
**Purpose**: Intelligent voice entry processing

**Setup**:
- Ollama with Llama 3.2 3B/8B
- Exposed via ngrok
- Processes voice entries for time slot inference

**Future**: Move to Raspberry Pi for lower power consumption

### 4. React Frontend
**Purpose**: User interface for voice logging and management

**Features**:
- Google OAuth login
- Template selection
- Voice recording interface
- Journal viewing

## 🔄 User Flow

### Onboarding Flow
1. User logs in with Google OAuth
2. User selects journal template
3. User sets preferences (folder name, journal time)
4. **NEW**: System creates Apps Script on user's Drive
5. **NEW**: Apps Script is configured with user preferences
6. **NEW**: Apps Script sets up triggers automatically
7. User redirected to dashboard

### Daily Automated Flow (Apps Script)
1. Trigger fires at configured time (e.g., 6:00 AM)
2. Apps Script creates daily journal document
3. Apps Script creates calendar event reminder
4. Hourly trigger checks if journal is filled
5. Sends email reminder if incomplete
6. Midnight: Analyzes previous day
7. Weekly/Monthly: Generates summary reports

### Voice Logging Flow
1. User opens dashboard
2. User clicks "Start Recording"
3. Browser captures voice (Web Speech API)
4. Frontend sends to Node.js API
5. **NEW**: API routes to LLM service (M1 Mac via ngrok)
6. **NEW**: LLM extracts time slot, context, location
7. **NEW**: API updates Google Doc at inferred time slot
8. User sees confirmation

## 🔧 Technical Implementation

### Apps Script Creation Process

```javascript
// User preferences stored in database
{
  templateId: "abc123",
  journalFolderName: "Daily Journals",
  journalTimeHour: 6,
  journalTimeMinute: 0,
  llmApiUrl: "https://your-ngrok-url.ngrok.io"
}

// Apps Script template injected with these values
// Script created via Google Apps Script API
// Deployed as web app for voice logging endpoint
```

### LLM Integration

**Smart Routing**:
1. Try regex/rules first (80% of cases, instant)
2. If ambiguous, use LLM (20% of cases, 2-3 seconds)
3. Fallback to simple detection if LLM fails

**M1 Mac Setup**:
- Ollama server running on localhost:11434
- ngrok tunnel exposes it publicly
- Node.js API calls ngrok URL

## 📊 Data Flow

### Voice Entry Processing
```
User Voice → Frontend → Node.js API
                              ↓
                    Smart Routing Logic
                    /              \
        Simple Detection      LLM Service
        (Regex/Rules)         (M1 Mac/Ollama)
                    \              /
                      ↓
            Google Docs Update
            (via Apps Script webhook)
```

### Apps Script Creation
```
Onboarding Complete → Node.js API
                            ↓
            Google Apps Script API
                            ↓
        Create Script File on User Drive
                            ↓
        Inject User Preferences
                            ↓
        Deploy as Web App
                            ↓
        Set Up Time-based Triggers
```

## 🔐 Security Considerations

1. **OAuth Tokens**: Stored encrypted in database
2. **Apps Script**: Runs in user's Google account (isolated)
3. **LLM API**: Protected via ngrok auth tokens
4. **API Endpoints**: JWT authentication required

## 📈 Scalability

### Current Architecture Scales Well Because:
- Each user's automation runs independently
- No shared cron job server
- LLM can handle 10-20 requests/minute per M1 Mac
- Can add more M1 Macs or move to cloud GPU if needed

### Future Scaling Options:
- Multiple M1 Macs behind load balancer
- Raspberry Pi cluster for edge deployment
- Cloud GPU (RunPod, Vast.ai) for higher volume
- Distributed LLM infrastructure

## 🧪 Testing Strategy (TDD)

### Test Categories:
1. **Unit Tests**: Services, utilities, LLM integration
2. **Integration Tests**: API endpoints, Apps Script creation
3. **E2E Tests**: Full onboarding and voice logging flow

### Test Coverage Goals:
- Services: 80%+
- Routes: 70%+
- Critical paths: 100%

## 🚀 Deployment

### Development:
- M1 Mac: Ollama + ngrok
- Node.js API: Local development
- Frontend: React dev server

### Production:
- Node.js API: Cloud Run / Heroku / Railway
- Frontend: Vercel / Netlify
- LLM: M1 Mac (or cloud GPU)
- Database: PostgreSQL (managed)

## 📝 Migration Notes

### From Old Architecture:
- **Remove**: Cron job infrastructure
- **Add**: Apps Script creation service
- **Add**: LLM service integration
- **Update**: Onboarding flow
- **Update**: Voice entry processing

### Database Changes:
- Add `apps_script_id` to `user_templates` table
- Add `apps_script_webapp_url` to `user_templates` table
- Add `llm_usage_logs` table for tracking

## ✅ Success Criteria

1. ✅ User completes onboarding → Apps Script created automatically
2. ✅ Daily journal created at configured time (no manual intervention)
3. ✅ Voice entries processed with LLM intelligence
4. ✅ Hourly reminders work automatically
5. ✅ Analysis emails sent automatically
6. ✅ All tests passing
7. ✅ Documentation updated

## 🎯 Phase 1 Implementation Checklist

- [ ] Create Apps Script template
- [ ] Build Apps Script creation service
- [ ] Integrate Google Apps Script API
- [ ] Create LLM service
- [ ] Update onboarding flow
- [ ] Integrate LLM into voice processing
- [ ] Write tests (TDD)
- [ ] Update documentation
- [ ] Create Mermaid diagrams
- [ ] Setup guide for M1 Mac LLM

