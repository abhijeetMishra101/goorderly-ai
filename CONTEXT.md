# GoOrderly.ai - Project Context

## Project Origin
This project originated from a ChatGPT conversation about building an AI-powered voice journaling and reflection assistant. The conversation included brainstorming, code development, and brand positioning.

## Project Overview

**GoOrderly.ai** is an AI-powered voice journaling and reflection assistant designed for professionals who value discipline, productivity, and structured self-reflection.

### Core Concept
- Daily automated journal creation in Google Docs
- Voice-powered activity logging via web app
- Automatic daily analysis and insights
- Weekly and monthly summary reports with charts
- Smart context detection, geo-tagging, and calendar integration

## Brand Identity

### Name
**GoOrderly.ai** - Energetic, action-oriented brand name that conveys "Take charge of your day"

### Brand Tone
- Calm, structured, intentional, mindful
- Appeals to professionals valuing discipline and productivity
- Positioned as a tool for intentional living and structured self-reflection

### Key Adjectives
- Disciplined, Organized, Efficient, Intentional, Consistent, Mindful
- Punctual, Structured, Methodical, Goal-oriented, Balanced

### Target Audience
- Professionals who value time management and structured routines
- Those seeking AI-powered reflection and self-improvement
- People who want to maintain consistent journaling habits

## Current Implementation (Google Apps Script)

### Core Features Implemented
1. **Daily Journal Creation**
   - Creates new journal doc at 6:00 AM daily
   - Based on template document
   - Stores in "Daily Journals" folder
   - Creates calendar event reminder

2. **Hourly Reminder System**
   - Checks every hour if journal is filled
   - Sends email reminders if journal appears incomplete
   - Only activates after journal creation time

3. **Daily Analysis**
   - Runs at 12:00 AM
   - Analyzes previous day's journal
   - Sends email with stats and reflection tips

4. **Weekly Summary**
   - Runs every Monday at 12:10 AM
   - Aggregates last 7 days
   - Includes chart visualization

5. **Monthly Summary**
   - Runs 1st of each month at 12:20 AM
   - Aggregates last 30 days
   - Includes chart visualization

### Template Structure
The journal template includes:
- Date and hourly plan
- To-do lists (#office #personal #health)
- Notes and quick logs
- Time slots (06:00 - 12:00 AM)
- End of day analysis section
- Productivity score and mental/physical state

## Planned Features

### Phase 1: Voice Logging Web App
- HTML5 speech recognition interface
- Mobile-friendly web app
- Auto-fills current time slot based on entry time
- Geo-tagging support
- Context detection (meeting, fitness, errand, etc.)

### Phase 2: Enhanced Analytics
- Reflective recaps with personalized tips
- Visual reinforcement (trendlines, badges)
- Consistency scoring
- Motivational quotes

### Phase 3: Smart Integrations
- Calendar event creation from voice entries
- Location-based tagging (reverse geocoding)
- Intent recognition and categorization
- AI-powered daily summaries

### Phase 4: Reward System
- Streak tracking
- Milestone celebrations (7-day, 21-day, 100-day)
- Auto-generated reflection reports
- Achievement badges

## Technical Architecture

### Current Stack
- **Backend**: Google Apps Script
- **Frontend**: HTML5 + Web Speech API
- **Storage**: Google Drive (Docs)
- **Communication**: Gmail API, Calendar API

### Future Stack (Planned)
- **Backend**: Node.js/Express or Firebase Functions
- **Frontend**: React or Flutter
- **AI/ML**: OpenAI Whisper (speech-to-text), GPT-4/Gemini (summaries)
- **Storage**: Google Drive API + Firestore
- **Deployment**: Cloud Run or Firebase Hosting

## Key Code Components

### Apps Script Functions
- `createDailyJournalAndCalendarEvent()` - Creates journal at 6 AM
- `checkIfJournalFilled()` - Hourly reminder check
- `analyzeYesterdayJournal()` - Daily analysis at midnight
- `sendWeeklySummary()` - Weekly aggregation
- `sendMonthlySummary()` - Monthly aggregation
- `setupTriggersStartingTomorrow()` - One-time trigger setup
- `setupAnalysisTriggers()` - Analysis trigger setup
- `doPost(e)` - Web app endpoint for voice entries
- `parseJournalContent()` - Extracts structured data from journal
- `buildFillRateChart()` - Generates visualization charts

### Analysis Features
- Filled vs empty time slot detection
- Character count tracking
- Productivity score calculation
- Mental/physical state mentions
- To-do item tracking
- Fill rate percentage calculation

## Project Roadmap

### Immediate Next Steps
1. Transfer codebase to Cursor for modular development
2. Convert Apps Script backend to Node.js/Express API
3. Build React frontend for voice logging
4. Integrate Whisper API for better speech recognition
5. Add geo-tagging and reverse geocoding

### Medium Term
1. Implement streak tracking and rewards
2. Add AI-powered daily summaries
3. Build dashboard for analytics visualization
4. Mobile app development (React Native or Flutter)

### Long Term
1. Multi-user support
2. Team/collaboration features
3. Integration marketplace
4. Premium AI features

## Notes for Development

### Important Considerations
- Timezone handling (currently uses Session.getScriptTimeZone())
- Trigger scheduling (must run setupTriggersStartingTomorrow() once)
- Template document ID needs to be configured
- Google API permissions required for Drive, Gmail, Calendar

### Design Principles
- Low friction entry (voice-first)
- Contextual intelligence (time, location, intent)
- Visual reinforcement (charts, badges)
- Positive reinforcement (streaks, rewards)
- Privacy-first (all data in user's Google Drive)

