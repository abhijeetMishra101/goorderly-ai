// src/services/journalService.js

const axios = require('axios');
const { getTodayYMD, isValidDateFormat, formatDateForHashtag, parseHashtagDate } = require('../utils/dateUtils');
const { detectContext } = require('../utils/contextDetector');
const { GoogleDriveService } = require('./googleDriveService');
const onboardingService = require('./userOnboardingService');
const SmartRouter = require('./smartRouter');

class JournalService {
  constructor(user, config = {}) {
    this.user = user;
    this.driveService = new GoogleDriveService(user);
    this.smartRouter = new SmartRouter();
    this.config = config;
  }

  /**
   * Get user's journal configuration from database
   * @private
   */
  async _getUserConfig() {
    const userTemplate = await onboardingService.getUserSelectedTemplate(this.user.id);
    
    if (!userTemplate) {
      throw new Error('No template selected. Please complete onboarding first.');
    }

    return {
      templateId: userTemplate.Template.googleDocId,
      folderName: userTemplate.journalFolderName,
      journalTimeHour: userTemplate.journalTimeHour,
      journalTimeMinute: userTemplate.journalTimeMinute,
      appsScriptWebappUrl: userTemplate.appsScriptWebappUrl
    };
  }

  /**
   * Creates a new daily journal
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created journal document
   */
  async createDailyJournal(date = null, options = {}) {
    const journalDate = date || getTodayYMD();

    if (!isValidDateFormat(journalDate)) {
      throw new Error(`Invalid date format: ${journalDate}. Expected YYYY-MM-DD`);
    }

    try {
      // Get user's configuration from database
      const userConfig = await this._getUserConfig();

      // Ensure template has the hourly table before creating journal
      try {
        await this.driveService.updateTemplateWithHourlyTable(userConfig.templateId);
        console.log('[JournalService] Template checked/updated for hourly table');
      } catch (templateUpdateError) {
        console.warn('[JournalService] Failed to update template with hourly table:', templateUpdateError.message);
        // Continue anyway - template might already have table or update might not be critical
      }

      // Try to use Apps Script web app if available
      if (userConfig.appsScriptWebappUrl) {
        try {
          const webAppUrl = userConfig.appsScriptWebappUrl;
          const url = new URL(webAppUrl);
          url.searchParams.set('action', 'create');
          if (date) {
            url.searchParams.set('date', journalDate);
          }

          const response = await axios.get(url.toString(), {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
          });

          const result = response.data;

          if (result.error) {
            throw new Error(result.error);
          }

          // Process reminders from previous journals
          // Get folder ID for reminder processing
          const folder = await this.driveService.getOrCreateFolder(userConfig.folderName);
          await this._processRemindersForNewJournal(result.id, journalDate, folder.id);

          return {
            id: result.id,
            name: result.name,
            date: result.date,
            url: result.url
          };
        } catch (appsScriptError) {
          console.warn('[JournalService] Apps Script creation failed, falling back to direct API:', appsScriptError.message);
          // Fall through to direct API approach
        }
      }

      // Fallback: Use direct Google Drive API
      // Get or create folder
      const folder = await this.driveService.getOrCreateFolder(userConfig.folderName);

      // Duplicate template
      const journalDoc = await this.driveService.duplicateTemplate(
        journalDate,
        folder.id,
        userConfig.templateId
      );

      // Process reminders from previous journals
      await this._processRemindersForNewJournal(journalDoc.id, journalDate, folder.id);

      // Create calendar event if requested
      if (options.createCalendarEvent) {
        const startTime = new Date(`${journalDate}T${String(userConfig.journalTimeHour).padStart(2, '0')}:${String(userConfig.journalTimeMinute).padStart(2, '0')}:00`);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes

        await this.driveService.createCalendarEvent({
          title: `📝 Daily Journal (${journalDate})`,
          description: `Fill today's journal: ${journalDoc.webViewLink}`,
          startTime,
          endTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
      }

      return {
        id: journalDoc.id,
        name: journalDoc.name,
        date: journalDate,
        url: journalDoc.webViewLink
      };
    } catch (error) {
      throw new Error(`Failed to create daily journal: ${error.message}`);
    }
  }

  /**
   * Process reminders from previous journals and add them to the new journal
   * @private
   * @param {string} newJournalId - New journal document ID
   * @param {string} journalDate - Journal date in YYYY-MM-DD format
   * @param {string} folderId - Folder ID containing journals
   * @returns {Promise<void>}
   */
  async _processRemindersForNewJournal(newJournalId, journalDate, folderId) {
    try {
      console.log(`[DEBUG] Processing reminders for journal date: ${journalDate}`);
      
      // Format target date for hashtag matching (e.g., "14_Nov_2025")
      const targetDate = new Date(journalDate + 'T00:00:00');
      const hashtagDatePrefix = formatDateForHashtag(targetDate);
      console.log(`[DEBUG] Looking for reminders with hashtag prefix: ${hashtagDatePrefix}`);
      
      // Search journals from the last 7 days
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() - 1); // Up to yesterday
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7); // Last 7 days
      
      console.log(`[DEBUG] Searching journals from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      // Find journals in date range
      const previousJournals = await this.driveService.findJournalsInDateRange(
        folderId,
        startDate,
        endDate
      );
      
      console.log(`[DEBUG] Found ${previousJournals.length} previous journals to search`);
      
      // Search each journal for reminder hashtags
      const allReminders = [];
      for (const journal of previousJournals) {
        try {
          const journalText = await this.driveService.getDocumentText(journal.id);
          const reminders = this.driveService.findReminderHashtags(journalText, hashtagDatePrefix);
          
          if (reminders.length > 0) {
            console.log(`[DEBUG] Found ${reminders.length} reminders in journal ${journal.date}`);
            allReminders.push(...reminders);
          }
        } catch (error) {
          console.warn(`[DEBUG] Error reading journal ${journal.date}: ${error.message}`);
          // Continue with other journals
        }
      }
      
      console.log(`[DEBUG] Total reminders found: ${allReminders.length}`);
      
      // Process each reminder and add to appropriate time slot
      for (const reminder of allReminders) {
        try {
          // Convert hour:minute to time slot format (e.g., "1:30-2:30 PM")
          const timeSlot = this._convertTimeToSlot(reminder.hour, reminder.minute);
          
          // Build entry text for time slot
          const entryText = `• ${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}: ${reminder.task}`;
          
          console.log(`[DEBUG] Adding reminder "${reminder.task}" to time slot "${timeSlot}"`);
          
          // Insert into time slot
          const entryTime = new Date(`${journalDate}T${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}:00`);
          await this._insertEntryAtTimeSlot(newJournalId, entryText, timeSlot, entryTime);
          
          console.log(`[DEBUG] Successfully added reminder to time slot`);
        } catch (error) {
          console.warn(`[DEBUG] Error adding reminder "${reminder.task}": ${error.message}`);
          // Continue with other reminders
        }
      }
    } catch (error) {
      // Don't fail journal creation if reminder processing fails
      console.error(`[DEBUG] Error processing reminders: ${error.message}`);
    }
  }

  /**
   * Convert hour and minute to time slot format
   * @private
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   * @returns {string} Time slot string (e.g., "1:30-2:30 PM")
   */
  _convertTimeToSlot(hour, minute) {
    // Round DOWN to nearest 30-minute slot
    const slotStartMinute = minute < 30 ? 0 : 30;
    const slotStartHour = hour;
    const slotEndMinute = slotStartMinute === 0 ? 30 : 0;
    const slotEndHour = slotStartMinute === 0 ? slotStartHour : (slotStartHour + 1) % 24;

    // Convert to 12-hour format with AM/PM
    const formatTime12 = (h, m) => {
      const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${h12}:${String(m).padStart(2, '0')}`;
    };

    const ampm = slotEndHour >= 12 ? 'PM' : 'AM';
    return `${formatTime12(slotStartHour, slotStartMinute)} - ${formatTime12(slotEndHour, slotEndMinute)} ${ampm}`;
  }

  /**
   * Finds journal by date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object|null>} Journal document or null
   */
  async findJournalByDate(date) {
    if (!isValidDateFormat(date)) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }

    try {
      const userConfig = await this._getUserConfig();
      const fileName = `Journal - ${date}`;
      const folder = await this.driveService.getOrCreateFolder(userConfig.folderName);
      const file = await this.driveService.findFileByName(fileName, folder.id);

      if (!file) {
        return null;
      }

      return {
        id: file.id,
        name: file.name,
        date,
        url: file.webViewLink
      };
    } catch (error) {
      throw new Error(`Failed to find journal: ${error.message}`);
    }
  }

  /**
   * Gets the text content of a journal document
   * @param {string} documentId - Journal document ID
   * @returns {Promise<string>} Document text content
   */
  async getJournalContent(documentId) {
    try {
      const text = await this.driveService.getDocumentText(documentId);
      return text;
    } catch (error) {
      throw new Error(`Failed to get journal content: ${error.message}`);
    }
  }

  /**
   * Appends a voice entry to journal with intelligent processing
   * @param {string} documentId - Journal document ID
   * @param {Object} entry - Voice entry data
   * @returns {Promise<Object>} Success result
   */
  async appendVoiceEntry(documentId, entry) {
    console.log(`[DEBUG] ===== appendVoiceEntry called =====`);
    console.log(`[DEBUG] Document ID: ${documentId}`);
    console.log(`[DEBUG] Entry:`, entry);
    
    let { text, timestamp, lat, lng, context } = entry;

    if (!text || !text.trim()) {
      throw new Error('Entry text is required');
    }

    // Strip wake word variations (in case client didn't strip it)
    // Common misheard variations: "Hiku Adili", "Hey Goorderly", "Hey Go Orderly", etc.
    text = text
      .replace(/^(?:hiku|hey|hi|he)\s+(?:adili|goorderly|go\s+orderly|go\s+orderley)\s*/i, '')
      .replace(/^(?:goorderly|go\s+orderly|go\s+orderley)\s*/i, '')
      .trim();

    const currentTime = timestamp ? new Date(timestamp) : new Date();
    console.log(`[DEBUG] Current time: ${currentTime.toISOString()}`);
    console.log(`[DEBUG] Original text: "${entry.text}"`);
    console.log(`[DEBUG] Cleaned text: "${text}"`);

    // Use Smart Router for intelligent processing
    const extractedData = await this.smartRouter.processVoiceEntry(text, {
      currentTime,
      lat,
      lng
    });
    
    console.log(`[DEBUG] SmartRouter result:`, extractedData);

    // Check if this is a reminder
    // Allow fallback if LLM failed but simple detection found reminder with basic info
    if (extractedData.isReminder === true) {
      // If LLM provided full data, use it
      if (extractedData.task && extractedData.targetDate) {
      console.log(`[DEBUG] Detected REMINDER: task="${extractedData.task}", targetDate="${extractedData.targetDate}", targetTime="${extractedData.targetTime}"`);
      
      // Format target time (use current time if not specified)
      const targetTime = extractedData.targetTime || 
        `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
      
      // Parse target date and format for hashtag
      const targetDate = new Date(extractedData.targetDate + 'T00:00:00');
      const hashtagDate = formatDateForHashtag(targetDate);
      
      // Extract hour and minute from target time
      const [hour, minute] = targetTime.split(':').map(Number);
      
      // Create hashtag: #DD_Mon_YYYY_HH_MM
      const hashtag = `#${hashtagDate}_${String(hour).padStart(2, '0')}_${String(minute).padStart(2, '0')}`;
      
      // Build ToDo item text
      const todoItem = `${extractedData.task} ${hashtag}`;
      
      // Insert into ToDo list
      await this.driveService.insertIntoToDoList(documentId, todoItem);
      
      console.log(`[DEBUG] Added reminder to ToDo list: "${todoItem}"`);
      
        return {
          success: true,
          isReminder: true,
          task: extractedData.task,
          targetDate: extractedData.targetDate,
          targetTime: targetTime,
          hashtag: hashtag,
          usedLLM: extractedData.usedLLM || false
        };
      } else {
        // Fallback: LLM failed but simple detection found reminder
        // Try to extract task and use tomorrow as default date
        console.log(`[DEBUG] Reminder detected but LLM failed, using fallback extraction`);
        const task = extractedData.task || text.replace(/remind me (?:to )?/i, '').replace(/tomorrow|next week|next month/gi, '').trim();
        const tomorrow = new Date(currentTime);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const fallbackDate = tomorrow.toISOString().split('T')[0];
        const hashtagDate = formatDateForHashtag(fallbackDate);
        const targetTime = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
        const [hour, minute] = targetTime.split(':').map(Number);
        const hashtag = `#${hashtagDate}_${String(hour).padStart(2, '0')}_${String(minute).padStart(2, '0')}`;
        const todoItem = `${task} ${hashtag}`;
        
        await this.driveService.insertIntoToDoList(documentId, todoItem);
        console.log(`[DEBUG] Added reminder to ToDo list (fallback): "${todoItem}"`);
        
        return {
          success: true,
          isReminder: true,
          task: task,
          targetDate: fallbackDate,
          targetTime: targetTime,
          hashtag: hashtag,
          usedLLM: false,
          fallback: true
        };
      }
    }

    // Regular entry processing
    // Use extracted data or fallback to provided context
    const detectedContext = context || extractedData.context || detectContext(text);
    let timeSlot = extractedData.timeSlot;
    
    console.log(`[DEBUG] Detected context: ${detectedContext}`);
    console.log(`[DEBUG] Time slot: ${timeSlot ? `"${timeSlot}"` : 'null/undefined'}`);

    // Check if time slot is in the past - if so, convert to reminder for tomorrow
    // BUT only if the user explicitly mentioned a time (not inferred from current time)
    // If time was inferred from current time, always use it for today (even if slightly in the past)
    const hasExplicitTime = extractedData.hasExplicitTime === true; // Only true if explicitly set to true
    
    if (timeSlot && hasExplicitTime) {
      const timeSlotInfo = this._parseTimeSlotForReminder(timeSlot, currentTime);
      if (timeSlotInfo && timeSlotInfo.isPast) {
        console.log(`[DEBUG] Time slot "${timeSlot}" is in the past and was explicitly mentioned, converting to reminder for ${timeSlotInfo.targetDate}`);
        
        // Convert to reminder format
        const targetDate = timeSlotInfo.targetDate;
        const targetTime = `${String(timeSlotInfo.hour24).padStart(2, '0')}:${String(timeSlotInfo.minute).padStart(2, '0')}`;
        const hashtagDate = formatDateForHashtag(new Date(targetDate + 'T00:00:00'));
        const hashtag = `#${hashtagDate}_${String(timeSlotInfo.hour24).padStart(2, '0')}_${String(timeSlotInfo.minute).padStart(2, '0')}`;
        
        // Build reminder text (remove time reference from original text if present)
        const reminderText = text.replace(/\d{1,2}\s*o['']?clock|\bat\s+\d{1,2}|\d{1,2}\s*(am|pm)|\d{1,2}:\d{2}\s*(am|pm)?/gi, '').trim();
        const todoItem = `${reminderText} ${hashtag}`;
        
        // Insert into ToDo list as reminder
        await this.driveService.insertIntoToDoList(documentId, todoItem);
        
        console.log(`[DEBUG] Added reminder to ToDo list: "${todoItem}"`);
        
        return {
          success: true,
          isReminder: true,
          task: reminderText,
          targetDate: targetDate,
          targetTime: targetTime,
          hashtag: hashtag,
          usedLLM: extractedData.usedLLM || false,
          convertedFromTimeSlot: true
        };
      }
    }

    // Format timestamp
    const timeStr = currentTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    // Build entry text
    let entryText = `• ${timeStr}: ${text}`;

    // Add geo-tagging if coordinates provided
    if (lat !== undefined && lng !== undefined) {
      entryText += ` 📍(${lat.toFixed(3)},${lng.toFixed(3)})`;
    }

    // Add context tag if detected
    if (detectedContext) {
      entryText += ` #${detectedContext}`;
    }
    
    console.log(`[DEBUG] Final entry text: "${entryText}"`);

    try {
      // Route entry to appropriate section based on context and timeSlot
      if (timeSlot) {
        // Time-specific activity -> Hourly Plan
        console.log(`[DEBUG] Time slot exists, calling _insertEntryAtTimeSlot`);
        await this._insertEntryAtTimeSlot(documentId, entryText, timeSlot, currentTime);
      } else if (detectedContext === 'note' || detectedContext?.toLowerCase() === 'note') {
        // Quick note -> Notes / Quick Logs section
        console.log(`[DEBUG] Context is note, inserting into Notes section`);
        await this.driveService.insertIntoNotes(documentId, entryText);
      } else if (detectedContext === 'journal' || detectedContext?.toLowerCase() === 'journal' || text.includes('#')) {
        // Journal entry with hashtags -> Free-form Journal section
        console.log(`[DEBUG] Context is journal or has hashtags, inserting into Free-form Journal`);
        await this.driveService.insertIntoJournal(documentId, entryText);
      } else if (detectedContext && (detectedContext.includes('office') || detectedContext.includes('personal') || detectedContext.includes('health'))) {
        // Task with tags -> To-Do List
        console.log(`[DEBUG] Context has task tags, inserting into To-Do List`);
        await this.driveService.insertIntoToDoList(documentId, entryText);
      } else {
        // Fallback -> append at end
        console.log(`[DEBUG] No specific section match - appending at end`);
        await this.driveService.appendToDocument(documentId, entryText);
      }

      return {
        success: true,
        isReminder: false,
        context: detectedContext,
        timeSlot: timeSlot || null,
        usedLLM: extractedData.usedLLM || false
      };
    } catch (error) {
      console.error(`[DEBUG] Error in appendVoiceEntry:`, error);
      throw new Error(`Failed to append voice entry: ${error.message}`);
    }
  }

  /**
   * Insert entry at specific time slot in document (table-aware with row creation)
   * @private
   * @param {string} documentId - Document ID
   * @param {string} entryText - Entry text to insert
   * @param {string} timeSlot - Time slot (e.g., "3:30 - 4:30 PM")
   * @param {Date} entryTime - Actual entry time for range overlap checking
   * @returns {Promise<void>}
   */
  async _insertEntryAtTimeSlot(documentId, entryText, timeSlot, entryTime) {
    try {
      await this.driveService._initializeAPIs();
      
      // Get document content
      const doc = await this.driveService.docs.documents.get({
        documentId
      });

      // Step 1: Try to find table and insert in existing row (with range overlap check)
      console.log(`[DEBUG] Starting table insertion for entry: "${entryText.substring(0, 50)}..."`);
      const tableResult = await this._findAndInsertInTable(doc, documentId, entryText, timeSlot, entryTime);
      if (tableResult.success) {
        console.log(`[DEBUG] Table insertion successful (method: ${tableResult.method})`);
        return; // Successfully inserted in table
      } else {
        console.log(`[DEBUG] Table insertion failed: ${tableResult.reason}`);
      }

      // Step 2: Fallback - Try paragraph-based insertion (for non-table templates)
      const paragraphResult = await this._tryParagraphInsertion(doc, documentId, entryText, timeSlot);
      if (paragraphResult.success) {
        return; // Successfully inserted near time slot paragraph
      }

      // Step 3: Final fallback - Append at end (always works)
      console.warn(`[DEBUG] Time slot insertion failed for "${timeSlot}", appending at end`);
      await this.driveService.appendToDocument(documentId, entryText);
    } catch (error) {
      // Final fallback - always append at end
      console.error('Time slot insertion error:', error.message);
      await this.driveService.appendToDocument(documentId, entryText);
    }
  }

  /**
   * Find table and insert entry in matching row, or create row if missing
   * Uses range overlap checking to find best match when multiple rows contain the entry time
   * @private
   * @param {Object} doc - Document object from API
   * @param {string} documentId - Document ID
   * @param {string} entryText - Entry text to insert
   * @param {string} timeSlot - Time slot to match
   * @param {Date} entryTime - Actual entry time for range overlap checking
   * @returns {Promise<Object>} Result with success flag
   */
  async _findAndInsertInTable(doc, documentId, entryText, timeSlot, entryTime) {
    const bodyContent = doc.data.body.content;
    
    // Parse actual entry time (in minutes since midnight)
    const entryTimeMinutes = entryTime.getHours() * 60 + entryTime.getMinutes();
    console.log(`[DEBUG] Entry time: ${entryTime.getHours()}:${String(entryTime.getMinutes()).padStart(2, '0')} (${entryTimeMinutes} minutes since midnight)`);
    console.log(`[DEBUG] Looking for time slot: "${timeSlot}"`);
    
    // Search for tables in document
    let tableCount = 0;
    for (const element of bodyContent) {
      if (element.table) {
        tableCount++;
        console.log(`[DEBUG] Found table #${tableCount}`);
        const table = element.table;
        const tableIndex = element.startIndex;
        const rows = table.tableRows || [];
        console.log(`[DEBUG] Table has ${rows.length} rows`);
        
        // Find ALL rows that contain the entry time (range overlap check)
        const matchingRows = [];
        
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          const row = rows[rowIdx];
          const cells = row.tableCells || [];
          
          if (cells.length > 0) {
            const timeSlotCell = cells[0];
            const cellText = this._extractTextFromCell(timeSlotCell);
            console.log(`[DEBUG] Row ${rowIdx}: Cell text = "${cellText}"`);
            
            // Skip empty cells and header rows
            if (!cellText || cellText.trim().length === 0 || 
                cellText.toLowerCase().includes('time slot') || 
                cellText.toLowerCase().includes('task description')) {
              console.log(`[DEBUG] Row ${rowIdx}: Skipping empty/header row`);
              continue;
            }
            
            // First, try exact match (for backward compatibility)
            if (this._matchesTimeSlot(cellText, timeSlot)) {
              console.log(`[DEBUG] Row ${rowIdx}: Exact match found!`);
              matchingRows.push({
                rowIndex: rowIdx,
                row: row,
                matchType: 'exact',
                rangeWidth: 0, // Exact match has no range width
                startDistance: 0
              });
              continue;
            }
            
            // Then, check if entry time falls within this row's time range
            const rowRange = this._parseTimeSlotRange(cellText);
            if (rowRange) {
              console.log(`[DEBUG] Row ${rowIdx}: Parsed range = ${rowRange.startTime}-${rowRange.endTime} minutes (${Math.floor(rowRange.startTime/60)}:${rowRange.startTime%60} - ${Math.floor(rowRange.endTime/60)}:${rowRange.endTime%60})`);
              const inRange = entryTimeMinutes >= rowRange.startTime && entryTimeMinutes < rowRange.endTime;
              console.log(`[DEBUG] Row ${rowIdx}: Entry ${entryTimeMinutes} in range? ${inRange} (${entryTimeMinutes} >= ${rowRange.startTime} && ${entryTimeMinutes} < ${rowRange.endTime})`);
              
              if (inRange) {
                // Calculate match quality metrics
                const rangeWidth = rowRange.endTime - rowRange.startTime;
                const startDistance = Math.abs(entryTimeMinutes - rowRange.startTime);
                
                console.log(`[DEBUG] Row ${rowIdx}: Range overlap match! (width=${rangeWidth}min, distance=${startDistance}min)`);
                
                matchingRows.push({
                  rowIndex: rowIdx,
                  row: row,
                  matchType: 'range_overlap',
                  rangeWidth: rangeWidth,        // Smaller = more specific
                  startDistance: startDistance   // Smaller = closer start time
                });
              }
            } else {
              console.log(`[DEBUG] Row ${rowIdx}: Failed to parse time slot range from "${cellText}"`);
            }
          } else {
            console.log(`[DEBUG] Row ${rowIdx}: No cells found`);
          }
        }

        // Choose best match if multiple rows match
        let targetRowIndex = -1;
        let targetRow = null;
        
        console.log(`[DEBUG] Found ${matchingRows.length} matching rows`);
        
        if (matchingRows.length > 0) {
          // Sort by: exact match first, then narrowest range, then closest start time
          matchingRows.sort((a, b) => {
            // Exact matches first
            if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
            if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
            
            // Then prefer narrower range (more specific)
            if (a.rangeWidth !== b.rangeWidth) {
              return a.rangeWidth - b.rangeWidth;
            }
            
            // Finally, prefer closer start time
            return a.startDistance - b.startDistance;
          });
          
          const bestMatch = matchingRows[0];
          console.log(`[DEBUG] Best match: Row ${bestMatch.rowIndex} (type: ${bestMatch.matchType})`);
          targetRowIndex = bestMatch.rowIndex;
          targetRow = bestMatch.row;
        } else {
          console.log(`[DEBUG] No matching rows found - will create new row`);
        }

        // If matching row found, insert in Task Description cell (column 2)
        if (targetRowIndex >= 0 && targetRow) {
          console.log(`[DEBUG] Inserting into existing row ${targetRowIndex}`);
          const cells = targetRow.tableCells || [];
          
          if (cells.length >= 2) {
            const taskCell = cells[1];
            const cellContent = taskCell.content || [];
            let cellEndIndex = taskCell.startIndex || 0;
            
            // Calculate end index of cell
            if (cellContent.length > 0) {
              const lastElement = cellContent[cellContent.length - 1];
              cellEndIndex = lastElement.endIndex || cellEndIndex;
            } else {
              cellEndIndex = taskCell.startIndex || 0;
            }

            // Prepare entry text (remove timestamp prefix since it's in cell context)
            const cleanEntryText = entryText.replace(/^•\s*\d{1,2}:\d{2}:\s*/, '').trim();
            const textToInsert = cleanEntryText ? `• ${cleanEntryText}\n` : entryText + '\n';

            console.log(`[DEBUG] Inserting text at index ${cellEndIndex - 1}: "${textToInsert}"`);

            // Insert text into the cell
            await this.driveService.docs.documents.batchUpdate({
              documentId,
              requestBody: {
                requests: [{
                  insertText: {
                    location: {
                      index: cellEndIndex - 1
                    },
                    text: textToInsert
                  }
                }]
              }
            });
            
            console.log(`[DEBUG] Successfully inserted into row ${targetRowIndex}`);
            return { success: true, method: 'existing_row', matchType: matchingRows[0].matchType };
          } else {
            console.log(`[DEBUG] Row ${targetRowIndex} has only ${cells.length} cells, need at least 2`);
          }
        } else {
          // Row not found - create new row at correct chronological position
          console.log(`[DEBUG] Creating new row for time slot "${timeSlot}"`);
          const insertResult = await this._createTableRow(doc, documentId, table, rows, timeSlot, entryText, tableIndex);
          if (insertResult.success) {
            console.log(`[DEBUG] Successfully created new row`);
            return { success: true, method: 'new_row' };
          } else {
            console.log(`[DEBUG] Failed to create new row: ${insertResult.reason}`);
          }
        }
      }
    }

    if (tableCount === 0) {
      console.log(`[DEBUG] No tables found in document!`);
    }
    
    return { success: false, reason: 'no_table_found' };
  }

  /**
   * Create new table row at correct chronological position
   * @private
   * @param {Object} doc - Document object
   * @param {string} documentId - Document ID
   * @param {Object} table - Table object
   * @param {Array} rows - Existing table rows
   * @param {string} timeSlot - Time slot for new row
   * @param {string} entryText - Entry text to insert
   * @param {number} tableIndex - Table start index
   * @returns {Promise<Object>} Result with success flag
   */
  async _createTableRow(doc, documentId, table, rows, timeSlot, entryText, tableIndex) {
    try {
      // Parse time slot to determine insertion position
      const slotTime = this._parseTimeSlot(timeSlot);
      if (!slotTime) {
        return { success: false, reason: 'invalid_time_slot' };
      }

      // Find correct insertion position (chronological order)
      let insertAfterRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.tableCells || [];
        if (cells.length > 0) {
          const cellText = this._extractTextFromCell(cells[0]);
          const rowTime = this._parseTimeSlot(cellText);
          if (rowTime && rowTime.startTime < slotTime.startTime) {
            insertAfterRowIndex = i;
          } else {
            break;
          }
        }
      }

      // Get table element to find row insertion point
      const tableElement = doc.data.body.content.find(el => el.table === table);
      if (!tableElement) {
        return { success: false, reason: 'table_element_not_found' };
      }

      // Calculate row index for insertion
      const targetRowIndex = insertAfterRowIndex + 1;

      // Insert new row
      const requests = [{
        insertTableRow: {
          tableCellLocation: {
            tableStartLocation: {
              index: tableIndex
            },
            rowIndex: targetRowIndex,
            columnIndex: 0
          },
          insertBelow: false
        }
      }];

      // Execute row insertion
      const insertResponse = await this.driveService.docs.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });

      // Get updated document to find new row
      const updatedDoc = await this.driveService.docs.documents.get({ documentId });
      const updatedTable = updatedDoc.data.body.content.find(el => 
        el.table && el.startIndex === tableIndex
      );

      if (!updatedTable || !updatedTable.table) {
        return { success: false, reason: 'table_not_found_after_insertion' };
      }

      const updatedRows = updatedTable.table.tableRows || [];
      if (updatedRows.length <= targetRowIndex) {
        return { success: false, reason: 'row_not_created' };
      }

      const newRow = updatedRows[targetRowIndex];
      const newCells = newRow.tableCells || [];

      // Insert time slot in first cell
      if (newCells.length > 0) {
        const timeCell = newCells[0];
        // Table cells always have a paragraph element starting at startIndex + 1
        const timeCellIndex = (timeCell.startIndex || 0) + 1;
        await this.driveService.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: timeCellIndex },
                text: timeSlot
              }
            }]
          }
        });
      }

      // Insert entry text in second cell (Task Description)
      if (newCells.length > 1) {
        const taskCell = newCells[1];
        // Table cells always have a paragraph element starting at startIndex + 1
        const taskCellIndex = (taskCell.startIndex || 0) + 1;
        const cleanEntryText = entryText.replace(/^•\s*\d{1,2}:\d{2}:\s*/, '').trim();
        const textToInsert = cleanEntryText ? `• ${cleanEntryText}\n` : entryText + '\n';

        await this.driveService.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: taskCellIndex },
                text: textToInsert
              }
            }]
          }
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error creating table row:', error);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Try paragraph-based insertion (fallback for non-table templates)
   * @private
   * @param {Object} doc - Document object
   * @param {string} documentId - Document ID
   * @param {string} entryText - Entry text
   * @param {string} timeSlot - Time slot
   * @returns {Promise<Object>} Result with success flag
   */
  async _tryParagraphInsertion(doc, documentId, entryText, timeSlot) {
    const bodyContent = doc.data.body.content;
    const documentText = bodyContent
      .map(el => {
        if (el.paragraph?.elements) {
          return el.paragraph.elements.map(e => e.textRun?.content || '').join('');
        }
        return '';
      })
      .join('');

    // Find time slot in document text
    const slotPattern = new RegExp(timeSlot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i');
    const match = documentText.match(slotPattern);

    if (match && match.index !== undefined) {
      // Find the element containing this slot
      let currentIndex = 0;
      let targetElementIndex = -1;

      for (let i = 0; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph?.elements) {
          const elementText = element.paragraph.elements
            .map(e => e.textRun?.content || '')
            .join('');

          if (currentIndex <= match.index && match.index < currentIndex + elementText.length) {
            targetElementIndex = i;
            break;
          }
          currentIndex += elementText.length;
        }
      }

      // Insert after the time slot element
      if (targetElementIndex >= 0) {
        const insertIndex = bodyContent[targetElementIndex].endIndex || 0;
        
        await this.driveService.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertText: {
                location: {
                  index: insertIndex
                },
                text: entryText + '\n'
              }
            }]
          }
        });
        return { success: true };
      }
    }

    return { success: false, reason: 'time_slot_not_found_in_paragraphs' };
  }

  /**
   * Extract text content from a table cell
   * @private
   * @param {Object} cell - Table cell object
   * @returns {string} Cell text content
   */
  _extractTextFromCell(cell) {
    if (!cell.content) {
      console.log(`[DEBUG] Cell has no content property`);
      return '';
    }
    
    let text = '';
    for (const element of cell.content) {
      if (element.paragraph?.elements) {
        for (const elem of element.paragraph.elements) {
          if (elem.textRun?.content) {
            text += elem.textRun.content;
          }
        }
      }
    }
    const trimmed = text.trim();
    console.log(`[DEBUG] Extracted cell text: "${trimmed}" (raw length: ${text.length})`);
    return trimmed;
  }

  /**
   * Check if cell text matches time slot
   * @private
   * @param {string} cellText - Cell text content
   * @param {string} timeSlot - Time slot to match (e.g., "3:30 - 4:30 PM")
   * @returns {boolean} True if matches
   */
  _matchesTimeSlot(cellText, timeSlot) {
    // Normalize both strings for comparison
    const normalize = (str) => str
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[:\-]/g, ' ')
      .trim();
    
    const normalizedCell = normalize(cellText);
    const normalizedSlot = normalize(timeSlot);
    
    // Check for exact match or partial match
    if (normalizedCell.includes(normalizedSlot) || normalizedSlot.includes(normalizedCell)) {
      return true;
    }
    
    // Also check for 24-hour format match
    return this._matchesTimeSlot24Hour(cellText, timeSlot);
  }

  /**
   * Check if cell text matches time slot in 24-hour format
   * @private
   * @param {string} cellText - Cell text content
   * @param {string} timeSlot12 - Time slot in 12-hour format
   * @returns {boolean} True if matches
   */
  _matchesTimeSlot24Hour(cellText, timeSlot12) {
    // Convert 12-hour to 24-hour format
    const convertTo24Hour = (timeStr, ampm) => {
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (!match) return null;
      
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      
      if (ampm === 'PM' && hour !== 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    };

    const slotMatch = timeSlot12.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!slotMatch) return false;

    const start24 = convertTo24Hour(`${slotMatch[1]}:${slotMatch[2]}`, slotMatch[5]);
    const end24 = convertTo24Hour(`${slotMatch[3]}:${slotMatch[4]}`, slotMatch[5]);
    
    if (!start24 || !end24) return false;

    // Check if cell contains 24-hour format
    const cell24Pattern = new RegExp(`${start24.replace(':', '\\s*:?\\s*')}\\s*-\\s*${end24.replace(':', '\\s*:?\\s*')}`, 'i');
    return cell24Pattern.test(cellText);
  }

  /**
   * Parse time slot and check if it's in the past, returning reminder info if needed
   * @private
   * @param {string} timeSlot - Time slot string (e.g., "7:00 - 8:00 AM")
   * @param {Date} currentTime - Current time
   * @returns {Object|null} Object with isPast, targetDate, hour24, minute, or null
   */
  _parseTimeSlotForReminder(timeSlot, currentTime) {
    if (!timeSlot) return null;
    
    // Parse time slot format: "7:00 - 8:00 AM" or "7:00-8:00 AM"
    const match = timeSlot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    
    const startHour = parseInt(match[1], 10);
    const startMinute = parseInt(match[2], 10);
    const ampm = match[5].toUpperCase();
    
    // Convert to 24-hour format
    let hour24 = startHour;
    if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
    if (ampm === 'AM' && hour24 === 12) hour24 = 0;
    
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;
    const slotMinutes = hour24 * 60 + startMinute;
    
    // Check if time slot is in the past today
    const isPast = slotMinutes < currentMinutes;
    
    if (isPast) {
      // Calculate tomorrow's date
      const tomorrow = new Date(currentTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const targetDate = tomorrow.toISOString().split('T')[0];
      
      return {
        isPast: true,
        targetDate: targetDate,
        hour24: hour24,
        minute: startMinute
      };
    }
    
    return {
      isPast: false,
      hour24: hour24,
      minute: startMinute
    };
  }

  /**
   * Parse time slot string to get start time for comparison
   * @private
   * @param {string} timeSlot - Time slot string (e.g., "3:30 - 4:30 PM")
   * @returns {Object|null} Object with startTime (minutes since midnight) or null
   */
  _parseTimeSlot(timeSlot) {
    // Match 12-hour format: "3:30 - 4:30 PM"
    const match12 = timeSlot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
      let startHour = parseInt(match12[1], 10);
      const startMinute = parseInt(match12[2], 10);
      const ampm = match12[5].toUpperCase();
      
      if (ampm === 'PM' && startHour !== 12) startHour += 12;
      if (ampm === 'AM' && startHour === 12) startHour = 0;
      
      return {
        startTime: startHour * 60 + startMinute,
        startHour,
        startMinute
      };
    }

    // Match 24-hour format: "15:30 - 16:30"
    const match24 = timeSlot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (match24) {
      const startHour = parseInt(match24[1], 10);
      const startMinute = parseInt(match24[2], 10);
      
      return {
        startTime: startHour * 60 + startMinute,
        startHour,
        startMinute
      };
    }

    return null;
  }

  /**
   * Parse time slot range (start and end times) for range overlap checking
   * @private
   * @param {string} timeSlot - Time slot string (e.g., "3:30 - 4:30 PM" or "03:00-05:30PM")
   * @returns {Object|null} Object with startTime and endTime (minutes since midnight) or null
   */
  _parseTimeSlotRange(timeSlot) {
    // Match 12-hour format: "3:30 - 4:30 PM" or "03:00-05:30PM"
    const match12 = timeSlot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
      let startHour = parseInt(match12[1], 10);
      const startMinute = parseInt(match12[2], 10);
      let endHour = parseInt(match12[3], 10);
      const endMinute = parseInt(match12[4], 10);
      const ampm = match12[5].toUpperCase();
      
      // Store original endHour before conversion for wrap detection
      const originalEndHour = endHour;
      
      // Handle AM/PM for start time
      if (ampm === 'PM' && startHour !== 12) startHour += 12;
      if (ampm === 'AM' && startHour === 12) startHour = 0;
      
      // Handle AM/PM for end time
      // Both start and end times share the same AM/PM indicator
      // If original end hour is less than original start hour, it's next day (e.g., 11:30 PM - 1:00 AM)
      if (originalEndHour < parseInt(match12[1], 10)) {
        // Time wraps to next day
        if (ampm === 'PM') {
          // End time is next day (AM), so don't add 12
          // endHour stays as is (1, 2, 3, etc.)
        } else {
          // AM wrap: endHour is next day PM, so add 12
          endHour += 12;
        }
      } else {
        // Same day - apply AM/PM conversion (same as start time)
        if (ampm === 'PM' && endHour !== 12) {
          endHour += 12;
        } else if (ampm === 'AM' && endHour === 12) {
          endHour = 0;
        }
      }
      
      return {
        startTime: startHour * 60 + startMinute,
        endTime: endHour * 60 + endMinute,
        startHour,
        startMinute,
        endHour,
        endMinute
      };
    }

    // Match 24-hour format: "15:30 - 16:30" or "15:30-16:30"
    const match24 = timeSlot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (match24) {
      const startHour = parseInt(match24[1], 10);
      const startMinute = parseInt(match24[2], 10);
      let endHour = parseInt(match24[3], 10);
      const endMinute = parseInt(match24[4], 10);
      
      // Handle next-day wrap (e.g., 23:30 - 01:00)
      if (endHour < startHour) {
        endHour += 24;
      }
      
      return {
        startTime: startHour * 60 + startMinute,
        endTime: endHour * 60 + endMinute,
        startHour,
        startMinute,
        endHour,
        endMinute
      };
    }

    return null;
  }

  /**
   * Analyzes journal content
   * @param {string} documentId - Journal document ID
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeJournal(documentId) {
    try {
      const text = await this.driveService.getDocumentText(documentId);
      const { parseJournalContent } = require('../utils/journalParser');
      const analysis = parseJournalContent(text);

      const totalSlots = analysis.filledSlots + analysis.emptySlots || 18;
      analysis.fillRate = totalSlots > 0 
        ? (analysis.filledSlots / totalSlots) * 100 
        : 0;

      return analysis;
    } catch (error) {
      throw new Error(`Failed to analyze journal: ${error.message}`);
    }
  }
}

module.exports = {
  JournalService
};

