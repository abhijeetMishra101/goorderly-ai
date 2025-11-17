# Journal Template Structure

This document describes the structure of the daily journal template used by GoOrderly.ai.

## Template Sections

### 1. Header
```
🗓️ Daily Journal – {DATE}
```
- Automatically filled with today's date

### 2. Hourly Plan Section
```
⏰ Hourly Plan
```
- Pre-populated time slots from 06:00 AM to 12:00 AM

### 3. To-Do List
```
📋 To-Do List #office #personal #health
- Go to grocery store #14_Nov_2025_14_25
```
- Space for categorized tasks
- Supports hashtags for organization
- **Reminder System**: Tasks with reminder hashtags (e.g., `#14_Nov_2025_14_25`) are automatically moved to the target date's journal time slot

### 4. Notes & Quick Logs
```
🧠 Notes / Quick Logs

```

### 5. Free-form Journal
```
📝 Free-form Journal (tag people/topics using #hashtag)

Write anything here. Tag relevant people or topics inline using #e.g. #Andrew, #FocusTime, #Feedback.
```

### 6. Time Slots
```
Time Slot                    Task Description
06:00 - 06:30 AM            
06:30 - 07:30 AM            
07:30 - 08:30 AM            
08:30 - 09:30 AM            
09:30 - 10:30 AM            
10:30 - 11:30 AM            
11:30 AM - 12:30 PM         
12:30 - 1:30 PM             
1:30-2:30 PM                
2:30-3:30 PM                
3:30-4:30 PM                
4:30-5:30 PM                
5:30-6:30 PM                
6:30-7:30 PM                
7:30-8:30 PM                
8:30-9:30 PM                
9:30-10:30 PM               
10:30-11:30 PM              
11:30-12:00AM               
```

### 7. End of Day Analysis
```
📊 End of Day Analysis

🎯 What went well
- 

🚫 What didn't go well
- 

📈 Productivity Score (1–10): 

🧠 Mental/Physical State:
Example: Alert morning, post-lunch slump

🌱 What to improve tomorrow:
- 
```

## Template Features

### Time Slot Detection
The script uses regex pattern matching to find time slots:
```
/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/gi
```

### Fill Detection
A time slot is considered "filled" if there's at least 10 characters of text after the time slot label.

### Hashtag Support
Users can tag entries with hashtags like:
- `#office`
- `#personal`
- `#health`
- `#meeting`
- `#fitness`

### Voice Entry Format
When voice entries are logged, they appear as:
```
• HH:mm: [entry text] 📍(lat,lng) #context
```

### Reminder System
Users can create reminders by saying phrases like "Remind me tomorrow to go to grocery store". The system will:

1. **Detect Reminder Intent**: Uses LLM to identify reminder requests and extract:
   - Task description (e.g., "Go to grocery store")
   - Target date (e.g., "tomorrow" → 2025-11-14)
   - Target time (if specified, otherwise uses current time)

2. **Add to ToDo List**: Creates a ToDo item in today's journal with a reminder hashtag:
   ```
   - Go to grocery store #14_Nov_2025_14_25
   ```
   Hashtag format: `#DD_Mon_YYYY_HH_MM` (e.g., `#14_Nov_2025_14_25` = Nov 14, 2025 at 14:25)

3. **Automatic Processing**: When a new journal is created:
   - Searches all journals from the last 7 days
   - Finds ToDo items with reminder hashtags matching the new journal's date
   - Extracts the task and timestamp from the hashtag
   - Automatically adds the task to the appropriate time slot in the new journal

**Example Flow:**
- **Nov 13, 2025 at 14:25**: User says "Remind me tomorrow to go to grocery store"
- **Today's Journal (Nov 13)**: ToDo list gets: `- Go to grocery store #14_Nov_2025_14_25`
- **Nov 14, 2025**: When journal is created, system finds the reminder and adds:
  - Time slot `1:30-2:30 PM`: `• 14:25: Go to grocery store`

## Customization

To customize the template:
1. Create a new Google Doc with your desired structure
2. Replace `TEMPLATE_DOC_ID` in `Code.gs` with your template's ID
3. Ensure time slots follow the format: `HH:mm - HH:mm AM/PM`
4. Keep the date placeholder format: `{DATE}`

## Notes

- The template should be created in Google Docs
- The script will duplicate this template daily
- Voice entries are inserted below the matching time slot
- All changes to the template will be reflected in new journals

