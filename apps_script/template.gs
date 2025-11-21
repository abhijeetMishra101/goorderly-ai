// Apps Script Template
// This template will be injected with user-specific preferences during creation

// === CONFIGURATION (INJECTED BY BACKEND) ===
const TEMPLATE_DOC_ID = '{{TEMPLATE_DOC_ID}}'; // Injected from user's selected template
const JOURNAL_TIME_HOUR = {{JOURNAL_TIME_HOUR}}; // Injected from user preferences
const JOURNAL_TIME_MINUTE = {{JOURNAL_TIME_MINUTE}}; // Injected from user preferences
const JOURNAL_FOLDER_NAME = '{{JOURNAL_FOLDER_NAME}}'; // Injected from user preferences
const USER_EMAIL = Session.getActiveUser().getEmail();
const LLM_API_URL = '{{LLM_API_URL}}'; // Injected from backend (ngrok URL)

// Script property keys
const PROP_TODAY_DOC_ID = "TODAY_JOURNAL_DOC_ID";
const PROP_TODAY_DATE = "TODAY_JOURNAL_DATE";
const PROP_ACTIVE_FROM = "NEW_SCHEDULE_ACTIVE_FROM";

// === UTILITIES ===
function _todayYMD() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _tomorrowYMD() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// === ONE-TIME SETUP: rewire triggers to configured time + hourly, active starting tomorrow ===
function setupTriggersStartingTomorrow() {
  // 1) Mark when the new schedule should start
  PropertiesService.getScriptProperties().setProperty(PROP_ACTIVE_FROM, _tomorrowYMD());

  // 2) Remove existing triggers for these functions
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    const h = t.getHandlerFunction();
    if (h === 'createDailyJournalAndCalendarEvent' || h === 'checkIfJournalFilled') {
      ScriptApp.deleteTrigger(t);
    }
  }

  // 3) Create the new daily trigger at configured time
  ScriptApp.newTrigger('createDailyJournalAndCalendarEvent')
    .timeBased()
    .atHour(JOURNAL_TIME_HOUR)
    .nearMinute(JOURNAL_TIME_MINUTE)
    .everyDays(1)
    .create();

  // 4) Create the hourly trigger (runs every hour). Guard logic inside the function
  //    ensures it only does work on/after the active-from date and only for today's doc.
  ScriptApp.newTrigger('checkIfJournalFilled')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('Triggers set: daily ' + JOURNAL_TIME_HOUR + ':' + String(JOURNAL_TIME_MINUTE).padStart(2, '0') + ' + hourly. Will activate starting ' + _tomorrowYMD());
}

// === MAIN FUNCTION: Create journal and calendar invite ===
function createDailyJournalAndCalendarEvent() {
  const today = _todayYMD();

  // If user asked to start tomorrow, and it's still before that, do nothing.
  const activeFrom = PropertiesService.getScriptProperties().getProperty(PROP_ACTIVE_FROM);
  if (activeFrom && today < activeFrom) {
    Logger.log('New schedule not active yet. Skipping creation for today.');
    return;
  }

  // Create or get journal folder
  const folders = DriveApp.getFoldersByName(JOURNAL_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(JOURNAL_FOLDER_NAME);

  // Duplicate the template
  const template = DriveApp.getFileById(TEMPLATE_DOC_ID);
  const newDoc = template.makeCopy(`Journal - ${today}`, folder);
  const newDocUrl = newDoc.getUrl();
  const newDocId = newDoc.getId();

  // Replace {DATE} placeholder in document body
  const body = DocumentApp.openById(newDocId).getBody();
  body.replaceText('\\{DATE\\}', today);

  // Save the new doc ID and date for checks
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_TODAY_DOC_ID, newDocId);
  props.setProperty(PROP_TODAY_DATE, today);

  // Create calendar event at configured time
  const calendar = CalendarApp.getDefaultCalendar();
  const start = new Date();
  start.setHours(JOURNAL_TIME_HOUR, JOURNAL_TIME_MINUTE, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min
  calendar.createEvent(`📝 Daily Journal (${today})`, start, end, {
    description: `Fill today's journal: ${newDocUrl}`
  });

  Logger.log(`Created journal for ${today} at ${newDocUrl}`);
  
  // Return journal info for web app calls
  return {
    success: true,
    id: newDocId,
    name: `Journal - ${today}`,
    date: today,
    url: newDocUrl
  };
}

// === WEB APP ENDPOINT: Create journal on demand ===
function doGet(e) {
  try {
    const action = e.parameter.action || 'create';
    
    if (action === 'create') {
      // Create journal for today (or specified date)
      const dateParam = e.parameter.date;
      let targetDate = _todayYMD();
      
      if (dateParam) {
        // Validate date format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
          targetDate = dateParam;
        }
      }
      
      // Temporarily override today check for manual creation
      const result = createDailyJournalForDate(targetDate);
      
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Invalid action'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// === Helper: Create journal for specific date ===
function createDailyJournalForDate(dateStr) {
  // Create or get journal folder
  const folders = DriveApp.getFoldersByName(JOURNAL_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(JOURNAL_FOLDER_NAME);
  
  // Check if journal already exists
  const existingFiles = folder.getFilesByName(`Journal - ${dateStr}`);
  if (existingFiles.hasNext()) {
    const existingFile = existingFiles.next();
    return {
      success: true,
      id: existingFile.getId(),
      name: `Journal - ${dateStr}`,
      date: dateStr,
      url: existingFile.getUrl(),
      alreadyExists: true
    };
  }
  
  // Duplicate the template
  const template = DriveApp.getFileById(TEMPLATE_DOC_ID);
  const newDoc = template.makeCopy(`Journal - ${dateStr}`, folder);
  const newDocUrl = newDoc.getUrl();
  const newDocId = newDoc.getId();
  
  // Update template date placeholder
  const body = newDoc.getBody();
  body.replaceText('\\{DATE\\}', dateStr);
  
  // Save the new doc ID and date for checks (if it's today)
  const today = _todayYMD();
  if (dateStr === today) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(PROP_TODAY_DOC_ID, newDocId);
    props.setProperty(PROP_TODAY_DATE, today);
  }
  
  // Create calendar event at configured time (only for today)
  if (dateStr === today) {
    const calendar = CalendarApp.getDefaultCalendar();
    const start = new Date();
    start.setHours(JOURNAL_TIME_HOUR, JOURNAL_TIME_MINUTE, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min
    calendar.createEvent(`📝 Daily Journal (${dateStr})`, start, end, {
      description: `Fill today's journal: ${newDocUrl}`
    });
  }
  
  Logger.log(`Created journal for ${dateStr} at ${newDocUrl}`);
  
  return {
    success: true,
    id: newDocId,
    name: `Journal - ${dateStr}`,
    date: dateStr,
    url: newDocUrl,
    alreadyExists: false
  };
}

// === HOURLY CHECK: Is journal filled? (guarded to start tomorrow) ===
function checkIfJournalFilled() {
  Logger.log("Running checkIfJournalFilled...");

  const props = PropertiesService.getScriptProperties();
  const today = _todayYMD();
  const activeFrom = props.getProperty(PROP_ACTIVE_FROM);

  // Only operate on/after the activation date
  if (activeFrom && today < activeFrom) {
    Logger.log('New schedule not active yet. Skipping checks for today.');
    return;
  }

  // Ensure we only check today's journal (created by the daily job)
  const journalDate = props.getProperty(PROP_TODAY_DATE);
  if (journalDate !== today) {
    Logger.log(`No journal created for today (${today}) yet. Skipping reminder.`);
    return;
  }

  const docId = props.getProperty(PROP_TODAY_DOC_ID);
  if (!docId) {
    Logger.log("No document ID found in script properties.");
    return;
  }

  const bodyText = DocumentApp.openById(docId).getBody().getText();
  const currentLength = bodyText.length;
  const templateLength = getTemplateDocLength();

  Logger.log(`Current journal length: ${currentLength}`);
  Logger.log(`Template document length: ${templateLength}`);

  // Consider journal filled if it has 50+ more characters than template
  if (currentLength <= templateLength + 50) {
    Logger.log("Journal appears unfilled. Sending email reminder.");
    MailApp.sendEmail(
      USER_EMAIL,
      "⏰ Reminder: Your journal is still pending",
      `You haven't filled today's journal. Please complete it:\n\nhttps://docs.google.com/document/d/${docId}`
    );
  } else {
    Logger.log("Journal appears sufficiently filled. No email sent.");
  }
}

function getTemplateDocLength() {
  const doc = DocumentApp.openById(TEMPLATE_DOC_ID);
  const bodyText = doc.getBody().getText();
  const length = bodyText.length;
  Logger.log("Template document length: " + length);
  return length;
}

// === ANALYSIS HELPERS ===

// Extracts structured data from a journal doc
function parseJournalContent(text) {
  const analysis = {
    totalChars: text.length,
    filledSlots: 0,
    emptySlots: 0,
    productivityMentions: 0,
    mentalMentions: 0,
    todoLines: 0
  };

  // Count filled hourly slots
  const slotRegex = /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/gi;
  const slots = [...text.matchAll(slotRegex)];
  slots.forEach(slot => {
    const nextText = text.substring(slot.index + slot[0].length, slot.index + slot[0].length + 60);
    if (nextText.trim().length > 10) analysis.filledSlots++;
    else analysis.emptySlots++;
  });

  // Count mentions
  analysis.productivityMentions = (text.match(/productivity/gi) || []).length;
  analysis.mentalMentions = (text.match(/mental|physical|alert|tired|slump/gi) || []).length;
  analysis.todoLines = (text.match(/#office|#personal|#health/gi) || []).length;

  return analysis;
}

// === DAILY ANALYSIS (runs at 12:00 AM) ===
function analyzeYesterdayJournal() {
  const tz = Session.getScriptTimeZone();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = Utilities.formatDate(yesterday, tz, 'yyyy-MM-dd');
  const folder = getOrCreateJournalFolder();

  const files = folder.getFilesByName(`Journal - ${yesterdayStr}`);
  if (!files.hasNext()) {
    Logger.log(`No journal found for ${yesterdayStr}`);
    return;
  }

  const file = files.next();
  const doc = DocumentApp.openById(file.getId());
  const text = doc.getBody().getText();

  const result = parseJournalContent(text);

  const summary = `
🧾 **Daily Journal Analysis (${yesterdayStr})**
-----------------------------------------
📄 Total characters written: ${result.totalChars}
⏰ Hourly slots filled: ${result.filledSlots} / ${result.filledSlots + result.emptySlots}
🧠 Mental/Physical mentions: ${result.mentalMentions}
✅ To-do related lines: ${result.todoLines}
📈 Productivity mentions: ${result.productivityMentions}

💡 Suggestion:
${result.filledSlots < 5 ? 'Try filling more hourly slots tomorrow.' : 'Good consistency throughout the day!'}
`;

  MailApp.sendEmail({
    to: USER_EMAIL,
    subject: `📊 Daily Analysis – ${yesterdayStr}`,
    htmlBody: summary.replace(/\n/g, '<br>')
  });

  Logger.log("Sent daily analysis for " + yesterdayStr);
}

// === WEEKLY & MONTHLY SUMMARIES ===
function sendWeeklySummary() {
  sendPeriodSummary(7, "Weekly");
}

function sendMonthlySummary() {
  sendPeriodSummary(30, "Monthly");
}

// === CORE SUMMARY AGGREGATOR ===
function sendPeriodSummary(daysBack, label) {
  const tz = Session.getScriptTimeZone();
  const folder = getOrCreateJournalFolder();

  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - daysBack);
  let count = 0;
  let totalFilled = 0;
  let totalChars = 0;

  const perDayStats = [];

  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName();
    const match = name.match(/Journal - (\d{4}-\d{2}-\d{2})/);
    if (match) {
      const date = new Date(match[1]);
      if (date >= start && date <= now) {
        const text = DocumentApp.openById(f.getId()).getBody().getText();
        const result = parseJournalContent(text);
        const totalSlots = result.filledSlots + result.emptySlots || 18;
        perDayStats.push({
          date: match[1],
          fillRate: (result.filledSlots / totalSlots) * 100
        });
        totalFilled += result.filledSlots;
        totalChars += result.totalChars;
        count++;
      }
    }
  }

  if (count === 0) {
    Logger.log(`No journals found for last ${daysBack} days`);
    return;
  }

  const avgFilled = (totalFilled / count).toFixed(1);
  const avgChars = Math.round(totalChars / count);

  const chartBlob = buildFillRateChart(perDayStats, label);

  const summary = `
📆 **${label} Journal Summary**
-----------------------------------------
🗓️ Period: Last ${daysBack} days
📄 Total Journals: ${count}
✍️ Avg. Characters Written: ${avgChars}
⏰ Avg. Hourly Slots Filled: ${avgFilled}

💬 Keep it up! Regular journaling builds strong reflection habits.
`;

  MailApp.sendEmail({
    to: USER_EMAIL,
    subject: `📈 ${label} Journal Summary`,
    htmlBody: summary.replace(/\n/g, '<br>') + "<br><br><img src='cid:chartImage'>",
    inlineImages: { chartImage: chartBlob }
  });

  Logger.log(`Sent ${label} summary`);
}

// === CHART GENERATION ===
function buildFillRateChart(perDayStats, label) {
  const dataTable = Charts.newDataTable()
    .addColumn(Charts.ColumnType.STRING, 'Date')
    .addColumn(Charts.ColumnType.NUMBER, 'Fill %');

  perDayStats.sort((a, b) => a.date.localeCompare(b.date));
  perDayStats.forEach(stat => dataTable.addRow([stat.date, stat.fillRate]));

  const chart = Charts.newBarChart()
    .setDataTable(dataTable.build())
    .setTitle(`${label} Journal Fill Rate`)
    .setXAxisTitle('Fill %')
    .setYAxisTitle('Date')
    .setDimensions(700, 400)
    .setColors(['#4285F4'])
    .setLegendPosition(Charts.Position.NONE)
    .build();

  return chart.getAs('image/png');
}

// === FOLDER HELPER ===
function getOrCreateJournalFolder() {
  const folders = DriveApp.getFoldersByName(JOURNAL_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(JOURNAL_FOLDER_NAME);
}

// === TRIGGERS FOR ANALYSIS ===
function setupAnalysisTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    const fn = t.getHandlerFunction();
    if (["analyzeYesterdayJournal", "sendWeeklySummary", "sendMonthlySummary"].includes(fn)) {
      ScriptApp.deleteTrigger(t);
    }
  }

  // Daily analysis (midnight)
  ScriptApp.newTrigger("analyzeYesterdayJournal")
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  // Weekly (Monday 12:10 AM)
  ScriptApp.newTrigger("sendWeeklySummary")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(0)
    .nearMinute(10)
    .create();

  // Monthly (1st of month 12:20 AM)
  ScriptApp.newTrigger("sendMonthlySummary")
    .timeBased()
    .onMonthDay(1)
    .atHour(0)
    .nearMinute(20)
    .create();

  Logger.log("Analysis triggers set: Daily@12:00, Weekly@12:10, Monthly@12:20");
}

// === WEB APP ENDPOINT: Voice entry logging (via Node.js API) ===
// Note: This endpoint is kept for backward compatibility but voice entries
// now go through Node.js API with LLM processing
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const entry = data.text;
  const lat = data.lat || null;
  const lng = data.lng || null;
  const context = data.context || "";

  const now = new Date();
  const today = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const hour = now.getHours();
  const folder = getOrCreateJournalFolder();

  // Get today's doc
  const fileIter = folder.getFilesByName(`Journal - ${today}`);
  if (!fileIter.hasNext()) {
    return ContentService.createTextOutput("No Journal for today");
  }

  const doc = DocumentApp.openById(fileIter.next().getId());
  const body = doc.getBody();
  const allText = body.getText();

  // Find closest slot like 08:30 - 09:30 AM
  const ampm = hour < 12 ? "AM" : "PM";
  const slotRegex = new RegExp(`(\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}\\s*${ampm})`, "gi");
  const match = allText.match(slotRegex);
  if (match) {
    const range = body.findText(match[0]);
    if (range) {
      const locationStr = lat ? ` 📍(${lat.toFixed(3)},${lng.toFixed(3)})` : "";
      const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm');
      body.insertParagraph(range.getEndOffsetInclusive() + 1,
        `• ${stamp}: ${entry}${locationStr} ${context ? '#' + context : ''}`);
    }
  } else {
    body.appendParagraph(`• ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm')}: ${entry}`);
  }

  return ContentService.createTextOutput("Logged entry");
}

// === CONTEXT DETECTION ===
function detectContext(entry) {
  if (/meeting/i.test(entry)) return 'meeting';
  if (/gym|run|pushup/i.test(entry)) return 'fitness';
  if (/call|talk|chat/i.test(entry)) return 'communication';
  if (/repair|shop|drive/i.test(entry)) return 'errand';
  return '';
}

// === GEO-TAGGING ===
function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(res);
    return json.address?.city || json.address?.town || "";
  } catch(e) {
    return "";
  }
}

