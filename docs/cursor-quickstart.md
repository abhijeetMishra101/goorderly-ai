# Quick Start Guide for Cursor

## 🎯 What This Project Is

**GoOrderly.ai** is an AI-powered voice journaling assistant that:
- Creates daily journals automatically at 6 AM
- Lets you log activities via voice
- Analyzes your journaling patterns
- Sends weekly/monthly insights

## 📋 Context Transfer Summary

Since ChatGPT share links don't work in Cursor, here's what you need to know:

### Project Origins
- Started as a Google Apps Script automation
- Evolved into a full voice-powered journaling app
- Brand name: **GoOrderly.ai**
- Target: Professionals who value discipline and productivity

### Key Features Implemented
1. Daily journal creation (6 AM)
2. Hourly reminders
3. Daily analysis (midnight)
4. Weekly/monthly summaries with charts
5. Voice logging web app (basic)

### Planned Features
- Better speech recognition (Whisper API)
- AI summaries (GPT-4/Gemini)
- Streak tracking & rewards
- Mobile app
- Calendar integration

### Current Tech Stack
- Backend: Google Apps Script
- Frontend: HTML5 + Web Speech API
- Storage: Google Drive Docs

### Target Tech Stack (Future)
- Backend: Node.js/Express or Firebase Functions
- Frontend: React
- AI: OpenAI Whisper + GPT-4/Gemini
- Database: Firestore

## 🚀 Next Steps in Cursor

### Immediate Tasks
1. **Review the code** in `apps_script/Code.gs`
2. **Set up your template** - Create a Google Doc template
3. **Configure** - Update `TEMPLATE_DOC_ID` in Code.gs
4. **Test** - Run setup functions in Apps Script

### Development Tasks
1. **Convert to Node.js** - Migrate Apps Script to Express API
2. **Build React frontend** - Replace HTML with React app
3. **Add Whisper API** - Better speech recognition
4. **Implement analytics** - Dashboard for insights

## 📁 Project Structure

```
goorderly-ai/
├── CONTEXT.md              # Full project context
├── README.md               # Project overview
├── roadmap.md              # Development roadmap
├── apps_script/
│   └── Code.gs            # Current backend
├── frontend/
│   └── index.html         # Voice logging UI
└── docs/
    ├── template-structure.md
    └── technical-docs.md
```

## 💡 Key Design Principles

1. **Low friction** - Voice-first entry
2. **Contextual intelligence** - Time, location, intent
3. **Visual reinforcement** - Charts, badges
4. **Positive reinforcement** - Streaks, rewards
5. **Privacy-first** - All data in user's Google Drive

## 🎨 Brand Identity

- **Name**: GoOrderly.ai
- **Tone**: Calm, structured, intentional, mindful
- **Target**: Professionals valuing discipline and productivity
- **Key Adjectives**: Disciplined, Organized, Efficient, Intentional, Consistent

## 📚 Useful Commands for Cursor

### To understand the project:
```
"Read CONTEXT.md to understand the project background"
```

### To start development:
```
"Convert the Apps Script backend to a Node.js/Express API"
```

### To build frontend:
```
"Create a React frontend for the voice logging feature"
```

### To add features:
```
"Add OpenAI Whisper API integration for better speech recognition"
```

## 🔗 Important Links

- **Template Structure**: See `docs/template-structure.md`
- **Technical Docs**: See `docs/technical-docs.md`
- **Roadmap**: See `roadmap.md`

## 🐛 Common Issues

1. **Template ID not found**
   - Create your template in Google Docs first
   - Copy the ID from the URL

2. **Triggers not working**
   - Run `setupTriggersStartingTomorrow()` manually
   - Check timezone settings

3. **Voice logging not working**
   - Deploy the web app first
   - Update URL in `index.html`

## 📝 Notes

- All code is production-ready but needs your Google credentials
- The Apps Script version is fully functional
- Migration to Node.js is recommended for scalability
- Focus on UX improvements for better adoption

---

**Ready to code?** Start by reviewing `CONTEXT.md` and `apps_script/Code.gs` to understand the current implementation!

