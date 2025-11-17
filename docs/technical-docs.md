# GoOrderly.ai - Technical Documentation

## Architecture Overview

### Current Architecture (Google Apps Script)

```
┌─────────────────┐
│  Google Apps    │
│     Script      │
│                 │
│  ┌───────────┐  │
│  │ Triggers  │  │
│  └───────────┘  │
│       │         │
│  ┌────▼─────┐   │
│  │ Functions│   │
│  └────┬─────┘   │
│       │         │
└───────┼─────────┘
        │
        ├─────────────────┬──────────────────┐
        │                 │                  │
┌───────▼──────┐  ┌────────▼──────┐  ┌───────▼───────┐
│ Google Drive │  │  Gmail API    │  │ Calendar API  │
│  (Docs API)  │  │  (Email)      │  │  (Events)     │
└──────────────┘  └────────────────┘  └────────────────┘
```

### Planned Architecture (Future)

```
┌─────────────────────────────────────────────────┐
│              Frontend (React)                    │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Voice UI     │  │  Dashboard   │            │
│  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────┘
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────┐
│         Backend API (Node.js/Express)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Auth     │  │ Journal  │  │ Analytics│     │
│  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Google APIs  │ │  Database    │ │  AI Services │
│              │ │  (Firestore) │ │  (OpenAI/    │
│ - Drive      │ │              │ │   Gemini)    │
│ - Calendar   │ │              │ │              │
│ - Gmail      │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

## API Reference

### Google Apps Script Web App Endpoint

#### POST `/exec`
Logs a voice entry to today's journal.

**Request Body:**
```json
{
  "text": "I am going for car repair right now",
  "lat": 40.7128,
  "lng": -74.0060,
  "context": "errand"
}
```

**Response:**
```
Logged entry
```

**Error Responses:**
- `No Journal for today` - Journal hasn't been created yet

## Functions Reference

### Core Functions

#### `createDailyJournalAndCalendarEvent()`
Creates a new journal document and calendar event.

**Trigger:** Daily at 6:00 AM  
**Returns:** void

#### `checkIfJournalFilled()`
Checks if today's journal is filled and sends reminder if not.

**Trigger:** Every hour  
**Returns:** void

#### `analyzeYesterdayJournal()`
Analyzes the previous day's journal and sends analysis email.

**Trigger:** Daily at 12:00 AM  
**Returns:** void

#### `sendWeeklySummary()`
Sends weekly aggregated summary with chart.

**Trigger:** Every Monday at 12:10 AM  
**Returns:** void

#### `sendMonthlySummary()`
Sends monthly aggregated summary with chart.

**Trigger:** 1st of each month at 12:20 AM  
**Returns:** void

### Helper Functions

#### `parseJournalContent(text: string)`
Extracts structured data from journal text.

**Parameters:**
- `text` - Journal document text

**Returns:**
```javascript
{
  totalChars: number,
  filledSlots: number,
  emptySlots: number,
  productivityMentions: number,
  mentalMentions: number,
  todoLines: number
}
```

#### `detectContext(entry: string)`
Detects context from voice entry text.

**Parameters:**
- `entry` - Voice entry text

**Returns:** `'meeting' | 'fitness' | 'communication' | 'errand' | ''`

#### `reverseGeocode(lat: number, lng: number)`
Converts coordinates to city name.

**Parameters:**
- `lat` - Latitude
- `lng` - Longitude

**Returns:** City name string

## Data Models

### Journal Document
```javascript
{
  id: string,           // Google Doc ID
  date: string,         // YYYY-MM-DD format
  title: string,        // "Journal - YYYY-MM-DD"
  url: string,          // Google Doc URL
  folderId: string,     // Google Drive folder ID
  createdAt: Date,      // Creation timestamp
  filled: boolean       // Whether journal is filled
}
```

### Analysis Result
```javascript
{
  totalChars: number,
  filledSlots: number,
  emptySlots: number,
  productivityMentions: number,
  mentalMentions: number,
  todoLines: number,
  fillRate: number      // Percentage (0-100)
}
```

### Voice Entry
```javascript
{
  text: string,         // Transcribed text
  timestamp: Date,     // When entry was made
  lat?: number,         // Optional latitude
  lng?: number,         // Optional longitude
  context?: string      // Detected context tag
}
```

## Configuration

### Environment Variables

```javascript
const TEMPLATE_DOC_ID = 'YOUR_TEMPLATE_DOC_ID';
const JOURNAL_TIME_HOUR = 6;
const JOURNAL_TIME_MINUTE = 0;
const JOURNAL_FOLDER_NAME = 'Daily Journals';
```

### Script Properties

- `TODAY_JOURNAL_DOC_ID` - Current day's journal document ID
- `TODAY_JOURNAL_DATE` - Current day's date (YYYY-MM-DD)
- `NEW_SCHEDULE_ACTIVE_FROM` - When new schedule should activate

## Triggers

### Time-based Triggers

| Function | Schedule | Purpose |
|----------|----------|---------|
| `createDailyJournalAndCalendarEvent` | Daily 6:00 AM | Create new journal |
| `checkIfJournalFilled` | Every hour | Check completion |
| `analyzeYesterdayJournal` | Daily 12:00 AM | Analyze previous day |
| `sendWeeklySummary` | Monday 12:10 AM | Weekly report |
| `sendMonthlySummary` | 1st of month 12:20 AM | Monthly report |

### Event-based Triggers

| Function | Trigger | Purpose |
|----------|---------|---------|
| `doPost` | HTTP POST | Voice entry logging |

## Security Considerations

### Permissions Required
- Google Drive API (read/write)
- Gmail API (send emails)
- Calendar API (create events)

### Best Practices
- Store template ID in configuration
- Use script properties for sensitive data
- Validate user input in `doPost`
- Implement rate limiting for web app
- Log errors for debugging

## Error Handling

### Common Errors

1. **Template not found**
   - Check `TEMPLATE_DOC_ID` is correct
   - Ensure template is accessible

2. **Journal not created**
   - Check trigger is set up correctly
   - Verify timezone settings

3. **Permission denied**
   - Re-authorize script permissions
   - Check folder access

## Performance Optimization

### Current Limitations
- Apps Script execution time limit: 6 minutes
- API quota limits
- Sequential file processing

### Optimization Strategies
- Batch operations where possible
- Cache template length
- Use efficient regex patterns
- Minimize API calls

## Future Improvements

1. **Database Migration**
   - Move from Script Properties to Firestore
   - Enable querying and analytics

2. **API Improvements**
   - RESTful API design
   - GraphQL support
   - Webhook support

3. **Caching**
   - Redis for frequently accessed data
   - CDN for static assets

4. **Monitoring**
   - Error tracking (Sentry)
   - Performance monitoring
   - Usage analytics

## Testing

### Manual Testing Checklist
- [ ] Daily journal creation works
- [ ] Hourly reminders send correctly
- [ ] Daily analysis runs at midnight
- [ ] Weekly summary includes chart
- [ ] Monthly summary includes chart
- [ ] Voice entry logging works
- [ ] Geo-tagging functions correctly
- [ ] Context detection works

### Automated Testing (Future)
- Unit tests for parsing functions
- Integration tests for API endpoints
- E2E tests for voice logging flow

