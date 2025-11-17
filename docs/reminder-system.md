# Reminder System Documentation

## Overview
The reminder system allows users to create future-dated reminders through voice commands. Reminders are stored in the ToDo list section of the current journal and automatically processed when the target date's journal is created.

## How It Works

### 1. Creating a Reminder

Users can create reminders by speaking phrases like:
- "Remind me tomorrow to go to grocery store"
- "Remind me next week to call John"
- "Set a reminder for tomorrow at 3 PM to pick up dry cleaning"

**Example Scenario:**
- **Date**: November 13, 2025 at 14:25
- **User says**: "Remind me tomorrow to go to grocery store"
- **System processes**:
  1. LLM detects reminder intent
  2. Extracts task: "Go to grocery store"
  3. Extracts target date: "tomorrow" → 2025-11-14
  4. Extracts target time: Uses current time (14:25) since not specified
  5. Creates hashtag: `#14_Nov_2025_14_25`
  6. Adds to ToDo list: `- Go to grocery store #14_Nov_2025_14_25`

### 2. Reminder Hashtag Format

Reminder hashtags follow the format: `#DD_Mon_YYYY_HH_MM`

- `DD`: Day (01-31)
- `Mon`: Month abbreviation (Jan, Feb, Mar, etc.)
- `YYYY`: Year (4 digits)
- `HH`: Hour (00-23, 24-hour format)
- `MM`: Minute (00-59)

**Examples:**
- `#14_Nov_2025_14_25` = November 14, 2025 at 14:25 (2:25 PM)
- `#01_Dec_2025_09_00` = December 1, 2025 at 09:00 (9:00 AM)
- `#25_Dec_2025_18_30` = December 25, 2025 at 18:30 (6:30 PM)

### 3. Automatic Reminder Processing

When a new daily journal is created, the system:

1. **Searches Previous Journals**: Looks through all journals from the last 7 days
2. **Finds Matching Reminders**: Searches for ToDo items with reminder hashtags matching the new journal's date
3. **Extracts Information**: Parses the hashtag to get:
   - Task description
   - Target time (hour and minute)
4. **Adds to Time Slot**: Inserts the task into the appropriate time slot based on the target time

**Example Processing:**
- **New Journal Created**: November 14, 2025
- **System searches**: Journals from Nov 7-13, 2025
- **Finds reminder**: `- Go to grocery store #14_Nov_2025_14_25` in Nov 13 journal
- **Extracts**: Task = "Go to grocery store", Time = 14:25
- **Converts to time slot**: 14:25 → `1:30-2:30 PM` (rounds down to nearest 30-min slot)
- **Adds to journal**: Time slot `1:30-2:30 PM` gets entry: `• 14:25: Go to grocery store`

## Technical Implementation

### LLM Processing

The system uses an LLM (via SmartRouter) to detect reminder intent and extract structured information:

**LLM Prompt Enhancement:**
- Detects reminder keywords: "remind me", "set a reminder", etc.
- Extracts task description
- Parses relative dates: "tomorrow", "next week", "next month"
- Extracts specific times if mentioned
- Falls back to current time if no time specified

**LLM Response Format (Reminder):**
```json
{
  "isReminder": true,
  "task": "Go to grocery store",
  "targetDate": "2025-11-14",
  "targetTime": "14:25",
  "timeSlot": "1:30-2:30 PM",
  "context": "errand"
}
```

### Code Components

**Key Files:**
- `src/services/llmService.js` - LLM prompt and response parsing for reminders
- `src/services/smartRouter.js` - Routes reminder detection to LLM
- `src/services/journalService.js` - Handles reminder creation and processing
- `src/services/googleDriveService.js` - ToDo list insertion and reminder search
- `src/utils/dateUtils.js` - Date formatting utilities for hashtags

**Key Methods:**
- `appendVoiceEntry()` - Detects reminders and adds to ToDo list
- `_processRemindersForNewJournal()` - Processes reminders when journal is created
- `insertIntoToDoList()` - Inserts reminder into ToDo section
- `findReminderHashtags()` - Searches document text for reminder hashtags
- `findJournalsInDateRange()` - Finds journals within date range for searching

## Use Cases

### Use Case 1: Simple Tomorrow Reminder
**Input**: "Remind me tomorrow to go to grocery store" (Nov 13, 14:25)
**Result**: 
- ToDo item added: `- Go to grocery store #14_Nov_2025_14_25`
- On Nov 14, task appears in `1:30-2:30 PM` time slot

### Use Case 2: Reminder with Specific Time
**Input**: "Remind me tomorrow at 3 PM to call John" (Nov 13, 10:00)
**Result**:
- ToDo item added: `- Call John #14_Nov_2025_15_00`
- On Nov 14, task appears in `2:30-3:30 PM` time slot

### Use Case 3: Multiple Reminders
**Input**: Multiple reminders for the same date
**Result**: All reminders are processed and added to their respective time slots

## Limitations

1. **Date Range**: Only searches last 7 days of journals for reminders
2. **Time Slot Rounding**: Times are rounded down to nearest 30-minute slot
3. **LLM Dependency**: Requires LLM for accurate date parsing (falls back to simple detection)
4. **Single User**: Currently processes reminders only for the journal owner

## Future Enhancements

Potential improvements:
- Support for recurring reminders
- Reminder notifications/notifications
- Calendar integration for reminders
- Reminder editing and deletion
- Support for longer date ranges (weeks, months ahead)
- Multiple reminder formats (daily, weekly, monthly)

