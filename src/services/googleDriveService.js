// src/services/googleDriveService.js

const { google } = require('googleapis');
const googleAuthService = require('./googleAuthService');

class GoogleDriveService {
  constructor(user) {
    // If user is provided, use their OAuth tokens
    // Otherwise, use the provided auth (for backward compatibility)
    this.user = user;
    this.auth = null;
  }

  /**
   * Initialize Google APIs with user's OAuth tokens
   * @private
   */
  async _initializeAPIs() {
    if (this.user && !this.auth) {
      const oauth2Client = await googleAuthService.getOAuth2ClientForUser(this.user);
      this.auth = oauth2Client;
    }

    if (!this.auth) {
      throw new Error('Authentication required. Provide user or auth object.');
    }

    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.docs = google.docs({ version: 'v1', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  /**
   * Gets or creates a folder by name
   * @param {string} folderName - Name of the folder
   * @returns {Promise<Object>} Folder object with id
   */
  async getOrCreateFolder(folderName) {
    await this._initializeAPIs();
    try {
      // Try to find existing folder
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1
      });

      if (response.data.files && response.data.files.length > 0) {
        return { id: response.data.files[0].id, name: response.data.files[0].name };
      }

      // Create folder if not found
      const folder = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id, name'
      });

      return { id: folder.data.id, name: folder.data.name };
    } catch (error) {
      throw new Error(`Failed to get or create folder: ${error.message}`);
    }
  }

  /**
   * Duplicates a template document
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} folderId - Parent folder ID
   * @param {string} templateId - Template document ID
   * @returns {Promise<Object>} New document object
   */
  async duplicateTemplate(date, folderId, templateId) {
    await this._initializeAPIs();
    try {
      const fileName = `Journal - ${date}`;

      // Copy the template
      const copiedFile = await this.drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: fileName
        }
      });

      // Move to folder
      await this.drive.files.update({
        fileId: copiedFile.data.id,
        addParents: folderId,
        removeParents: 'root',
        fields: 'id, name, webViewLink'
      });

      // Replace {DATE} placeholder in document
      await this.docs.documents.batchUpdate({
        documentId: copiedFile.data.id,
        requestBody: {
          requests: [
            {
              replaceAllText: {
                containsText: {
                  text: '{DATE}',
                  matchCase: false
                },
                replaceText: date
              }
            }
          ]
        }
      });

      return {
        id: copiedFile.data.id,
        name: fileName,
        webViewLink: copiedFile.data.webViewLink || `https://docs.google.com/document/d/${copiedFile.data.id}`
      };
    } catch (error) {
      throw new Error(`Failed to duplicate template: ${error.message}`);
    }
  }

  /**
   * Finds a file by name
   * @param {string} fileName - Name of the file
   * @param {string} folderId - Optional folder ID to search in
   * @returns {Promise<Object|null>} File object or null if not found
   */
  async findFileByName(fileName, folderId = null) {
    await this._initializeAPIs();
    try {
      let query = `name='${fileName}' and trashed=false`;
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        pageSize: 1
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0];
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to find file: ${error.message}`);
    }
  }

  /**
   * Appends text to a document
   * @param {string} documentId - Document ID
   * @param {string} text - Text to append
   * @returns {Promise<Object>} Success result
   */
  async appendToDocument(documentId, text) {
    await this._initializeAPIs();
    try {
      // Get document to find insertion point
      const doc = await this.docs.documents.get({
        documentId
      });

      const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;

      await this.docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: endIndex
                },
                text: text + '\n'
              }
            }
          ]
        }
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to append to document: ${error.message}`);
    }
  }

  /**
   * Creates a calendar event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  async createCalendarEvent(eventData) {
    await this._initializeAPIs();
    try {
      const event = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: eventData.title,
          description: eventData.description || '',
          start: {
            dateTime: eventData.startTime.toISOString(),
            timeZone: eventData.timeZone || 'UTC'
          },
          end: {
            dateTime: eventData.endTime.toISOString(),
            timeZone: eventData.timeZone || 'UTC'
          }
        }
      });

      return event.data;
    } catch (error) {
      throw new Error(`Failed to create calendar event: ${error.message}`);
    }
  }

  /**
   * Creates a new Google Doc from text content
   * @param {string} title - Document title
   * @param {string} content - Document content (plain text)
   * @param {string} folderId - Optional folder ID to place document in
   * @returns {Promise<Object>} Created document info
   */
  async createDocumentFromText(title, content, folderId = null) {
    await this._initializeAPIs();
    try {
      // Create empty document
      const createResponse = await this.docs.documents.create({
        requestBody: {
          title: title
        }
      });

      const documentId = createResponse.data.documentId;

      // Parse content to extract hourly slots and build document structure
      const lines = content.split('\n');
      let beforeHourlyPlan = [];
      let hourlySlots = [];
      let afterHourlyPlan = [];
      let inHourlyPlanSection = false;
      let foundTimeSlotHeader = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Detect hourly plan section start
        if (trimmedLine.includes('⏰ Hourly Plan') || trimmedLine.includes('Hourly Plan')) {
          inHourlyPlanSection = true;
          beforeHourlyPlan.push(line);
          continue;
        }

        // Detect hourly plan section end (next section header)
        if (inHourlyPlanSection && (trimmedLine.startsWith('📋') || trimmedLine.startsWith('🧠') || trimmedLine.startsWith('📝') || trimmedLine.startsWith('📊'))) {
          inHourlyPlanSection = false;
          afterHourlyPlan.push(line);
          continue;
        }

        // Collect content
        if (inHourlyPlanSection) {
          // Check if this is a time slot pattern
          const timeSlotPattern = /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/i;
          if (timeSlotPattern.test(trimmedLine)) {
            hourlySlots.push(trimmedLine);
            foundTimeSlotHeader = true;
          } else if (trimmedLine === 'Time Slot' || trimmedLine === 'Task Description') {
            // Skip these as they'll be in the table header
            continue;
          } else if (trimmedLine.length === 0 && !foundTimeSlotHeader) {
            // Empty lines before time slots
            continue;
          }
        } else {
          // Find hourly plan index for comparison
          const hourlyPlanIndex = lines.findIndex(l => l.includes('⏰ Hourly Plan'));
          
          if (hourlyPlanIndex === -1 || i < hourlyPlanIndex) {
            // Content before hourly plan
            beforeHourlyPlan.push(line);
          } else {
            // Content after hourly plan
            afterHourlyPlan.push(line);
          }
        }
      }

      // Build document: insert content before hourly plan
      let currentIndex = 1;
      const requests = [];

      // Insert content before hourly plan
      const beforeText = beforeHourlyPlan.join('\n') + '\n\n';
      if (beforeText.trim().length > 0) {
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: beforeText
          }
        });
        currentIndex += beforeText.length;
      }

      // Execute initial text insertion
      if (requests.length > 0) {
        await this.docs.documents.batchUpdate({
          documentId,
          requestBody: { requests }
        });
      }

      // Get document to find current end index
      const doc = await this.docs.documents.get({ documentId });
      let insertIndex = 1;
      if (doc.data.body.content && doc.data.body.content.length > 0) {
        const lastElement = doc.data.body.content[doc.data.body.content.length - 1];
        insertIndex = lastElement.endIndex || 1;
      }

      // Split hourly slots into AM and PM
      const amSlots = hourlySlots.filter(slot => slot.includes('AM') || slot.includes('12:00 PM'));
      const pmSlots = hourlySlots.filter(slot => slot.includes('PM') && !slot.includes('12:00 PM'));

      // Helper function to create and fill a table
      const createAndFillTable = async (slots, idx) => {
        if (slots.length === 0) return idx;
        
        const tableRows = slots.length + 1; // +1 for header row

        // Create table
        await this.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertTable: {
                location: { index: idx },
                rows: tableRows,
                columns: 2
              }
            }]
          }
        });

        // Wait for table creation
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get document again to find the table
        const updatedDoc = await this.docs.documents.get({ documentId });
        const tableElement = updatedDoc.data.body.content.find(el => el.table && el.startIndex >= idx);
        
        if (tableElement && tableElement.table) {
          const table = tableElement.table;
          const tableRows_actual = table.tableRows || [];
          const fillRequests = [];

          // Fill header row
          if (tableRows_actual.length > 0) {
            const headerRow = tableRows_actual[0];
            const headerCells = headerRow.tableCells || [];
            
            // Header cell 1: Time Slot
            if (headerCells.length > 0) {
              const cell = headerCells[0];
              const insertIdx = cell.startIndex + 1;
              fillRequests.push({
                insertText: {
                  location: { index: insertIdx },
                  text: 'Time Slot'
                }
              });
            }
            
            // Header cell 2: Task Description
            if (headerCells.length > 1) {
              const cell = headerCells[1];
              const insertIdx = cell.startIndex + 1;
              fillRequests.push({
                insertText: {
                  location: { index: insertIdx },
                  text: 'Task Description'
                }
              });
            }
          }

          // Fill time slot rows
          for (let i = 0; i < slots.length && i + 1 < tableRows_actual.length; i++) {
            const row = tableRows_actual[i + 1];
            const cells = row.tableCells || [];
            
            if (cells.length > 0) {
              const cell = cells[0];
              const insertIdx = cell.startIndex + 1;
              fillRequests.push({
                insertText: {
                  location: { index: insertIdx },
                  text: slots[i]
                }
              });
            }
          }

          // Execute table fill
          if (fillRequests.length > 0) {
            await this.docs.documents.batchUpdate({
              documentId,
              requestBody: { requests: fillRequests }
            });
          }

          return tableElement.endIndex;
        }
        
        return idx;
      };

      // Create AM table first
      if (amSlots.length > 0) {
        insertIndex = await createAndFillTable(amSlots, insertIndex);
        
        // Add paragraph break between tables
        await this.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: insertIndex },
                text: '\n'
              }
            }]
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
        const docBeforePM = await this.docs.documents.get({ documentId });
        insertIndex = insertIndex + 1;
        for (const element of docBeforePM.data.body.content) {
          if (element.startIndex >= insertIndex && element.paragraph) {
            insertIndex = element.endIndex || insertIndex;
            break;
          }
        }
      }

      // Create PM table
      if (pmSlots.length > 0) {
        insertIndex = await createAndFillTable(pmSlots, insertIndex);
      }

      // Insert content after hourly plan
      if (afterHourlyPlan.length > 0) {
        const afterText = '\n\n' + afterHourlyPlan.join('\n');
        await this.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: insertIndex },
                text: afterText
              }
            }]
          }
        });
      }

      // Move to folder if specified
      if (folderId) {
        await this.drive.files.update({
          fileId: documentId,
          addParents: folderId,
          removeParents: 'root',
          fields: 'id, name, webViewLink'
        });
      }

      return {
        id: documentId,
        name: title,
        webViewLink: `https://docs.google.com/document/d/${documentId}/edit`
      };
    } catch (error) {
      throw new Error(`Failed to create document from text: ${error.message}`);
    }
  }

  /**
   * Updates an existing template document to add the hourly plan table
   * @param {string} documentId - Template document ID
   * @returns {Promise<Object>} Success result
   */
  async updateTemplateWithHourlyTable(documentId) {
    await this._initializeAPIs();
    try {
      // Get the document
      const doc = await this.docs.documents.get({ documentId });
      
      // Check if tables already exist - if they do, delete all of them to
      // recreate the hourly plan cleanly. This ensures we don't accumulate
      // multiple or corrupted tables over time.
      // Delete tables one at a time from end to beginning to avoid index shifting issues
      let docToUse = doc;
      let tablesToDelete = doc.data.body.content.filter(el => el.table);
      if (tablesToDelete.length > 0) {
        console.log(`[GoogleDriveService] Found ${tablesToDelete.length} existing table(s), deleting to recreate hourly plan`);
        
        // Delete tables one at a time, always deleting the last one (highest index)
        // This way indices don't shift for tables we haven't deleted yet
        while (tablesToDelete.length > 0) {
          // Sort by startIndex descending to get the last table first
          tablesToDelete.sort((a, b) => b.startIndex - a.startIndex);
          const lastTable = tablesToDelete[0];
          
        await this.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              deleteContentRange: {
                range: {
                    startIndex: lastTable.startIndex,
                    endIndex: lastTable.endIndex
                }
              }
            }]
          }
        });
          
          // Refresh document and re-find remaining tables
        docToUse = await this.docs.documents.get({ documentId });
          tablesToDelete = docToUse.data.body.content.filter(el => el.table);
        }
        
        console.log(`[GoogleDriveService] Successfully deleted all existing table(s)`);
      }

      // Get document text to find hourly plan section
      const bodyText = docToUse.data.body.content
        .map(el => {
          if (el.paragraph && el.paragraph.elements) {
            return el.paragraph.elements.map(e => e.textRun?.content || '').join('');
          }
          return '';
        })
        .join('');

      // Find "⏰ Hourly Plan" section
      const hourlyPlanIndex = bodyText.indexOf('⏰ Hourly Plan');
      if (hourlyPlanIndex === -1) {
        throw new Error('Hourly Plan section not found in template');
      }

      // Find the end of hourly plan section (next section marker)
      let endIndex = bodyText.length;
      const nextSectionMarkers = ['📋', '🧠', '📝', '📊'];
      for (const marker of nextSectionMarkers) {
        const markerIndex = bodyText.indexOf(marker, hourlyPlanIndex);
        if (markerIndex !== -1 && markerIndex < endIndex) {
          endIndex = markerIndex;
        }
      }

      // Extract hourly slots - split into AM and PM tables
      const amSlots = [
        '12:00 - 1:00 AM',
        '1:00 - 2:00 AM',
        '2:00 - 3:00 AM',
        '3:00 - 4:00 AM',
        '4:00 - 5:00 AM',
        '5:00 - 6:00 AM',
        '6:00 - 7:00 AM',
        '7:00 - 8:00 AM',
        '8:00 - 9:00 AM',
        '9:00 - 10:00 AM',
        '10:00 - 11:00 AM',
        '11:00AM - 12:00 PM'
      ];
      
      const pmSlots = [
        '12:00-1:00 PM',
        '1:00-2:00 PM',
        '2:00-3:00 PM',
        '3:00-4:00 PM',
        '4:00-5:00 PM',
        '5:00-6:00 PM',
        '6:00-7:00 PM',
        '7:00-8:00 PM',
        '8:00-9:00 PM',
        '9:00-10:00 PM',
        '10:00-11:00 PM',
        '11:00 PM -12:00 AM'
      ];
      
      // Combined for deletion/search purposes
      const hourlySlots = [...amSlots, ...pmSlots];

      // Find the paragraph containing "⏰ Hourly Plan" to get insertion index
      let tableInsertIndex = 1;
      let currentTextIndex = 0;
      
      for (const element of docToUse.data.body.content) {
        if (element.paragraph) {
          const paraText = element.paragraph.elements
            ?.map(e => e.textRun?.content || '')
            .join('') || '';
          
          if (currentTextIndex + paraText.length > hourlyPlanIndex) {
            // Found the paragraph containing "⏰ Hourly Plan"
            // Insert table after this paragraph
            tableInsertIndex = element.endIndex || tableInsertIndex;
            break;
          }
          currentTextIndex += paraText.length;
          tableInsertIndex = element.endIndex || tableInsertIndex;
        }
      }

      // Delete ALL content between "⏰ Hourly Plan" and the next section
      // This ensures we remove any corrupted text or tables
      // Refresh document first to get current state after table deletion
      docToUse = await this.docs.documents.get({ documentId });
      
      // Find the paragraph containing "⏰ Hourly Plan" to get the start index
      let deleteStartDocIndex = null;
      
      for (const element of docToUse.data.body.content) {
        if (element.paragraph && element.paragraph.elements) {
          const paraText = element.paragraph.elements
            ?.map(e => e.textRun?.content || '')
            .join('') || '';
          
          if (paraText.includes('⏰ Hourly Plan')) {
            // Found the paragraph - delete everything after it until next section
            // Use endIndex to delete everything after the "⏰ Hourly Plan" text
            deleteStartDocIndex = element.endIndex || element.startIndex;
            break;
          }
        }
      }

      if (!deleteStartDocIndex) {
        throw new Error('Could not find "⏰ Hourly Plan" paragraph in document');
      }

      // Find the next section marker to determine end of deletion
      let deleteEndDocIndex = null;
      
      for (const element of docToUse.data.body.content) {
        if (element.paragraph && element.paragraph.elements) {
          const paraText = element.paragraph.elements
            ?.map(e => e.textRun?.content || '')
            .join('') || '';
          
          // Check if this paragraph contains a next section marker
          for (const marker of nextSectionMarkers) {
            if (paraText.includes(marker) && element.startIndex > deleteStartDocIndex) {
              deleteEndDocIndex = element.startIndex;
              break;
            }
          }
          if (deleteEndDocIndex) break;
        }
      }

      // If we didn't find a next section, delete until end of document
      if (!deleteEndDocIndex) {
        // Find the last element's end index
        const lastElement = docToUse.data.body.content[docToUse.data.body.content.length - 1];
        deleteEndDocIndex = lastElement?.endIndex || deleteStartDocIndex + 1;
      }

      // Delete all content between "⏰ Hourly Plan" and next section
      if (deleteEndDocIndex > deleteStartDocIndex) {
        console.log(`[GoogleDriveService] Deleting content from index ${deleteStartDocIndex} to ${deleteEndDocIndex} (${deleteEndDocIndex - deleteStartDocIndex} chars)`);
        await this.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              deleteContentRange: {
                range: {
                  startIndex: deleteStartDocIndex,
                  endIndex: deleteEndDocIndex
                }
              }
            }]
          }
        });
        // Refresh document after deletion
        docToUse = await this.docs.documents.get({ documentId });
        console.log(`[GoogleDriveService] Successfully deleted old content`);
      } else {
        console.log(`[GoogleDriveService] No content to delete (start: ${deleteStartDocIndex}, end: ${deleteEndDocIndex})`);
      }

      // Get document again to find current insertion point (refresh if needed)
      const updatedDoc = docToUse;
      let currentInsertIndex = 1;
      currentTextIndex = 0;
      
      for (const element of updatedDoc.data.body.content) {
        if (element.paragraph) {
          const paraText = element.paragraph.elements
            ?.map(e => e.textRun?.content || '')
            .join('') || '';
          
          if (currentTextIndex + paraText.length > hourlyPlanIndex) {
            currentInsertIndex = element.endIndex || currentInsertIndex;
            break;
          }
          currentTextIndex += paraText.length;
          currentInsertIndex = element.endIndex || currentInsertIndex;
        }
      }

      // Helper function to create and fill a table
      const createAndFillTable = async (slots, insertIndex) => {
        const tableRows = slots.length + 1; // +1 for header row
        
        // Create table
        await this.docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertTable: {
                location: { index: insertIndex },
                rows: tableRows,
                columns: 2
              }
            }]
          }
        });

        // Wait a moment for table to be fully created
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get fresh document to find the table
        const docAfterTable = await this.docs.documents.get({ documentId });
        const tableElement = docAfterTable.data.body.content.find(el => el.table && el.startIndex >= insertIndex);
        
        if (tableElement && tableElement.table) {
          const table = tableElement.table;
          const tableRows_actual = table.tableRows || [];
          
          // First, clear all cell content
          const deleteRequests = [];
          const cellsToFill = [];
          
          // Helper to collect cell clearing and filling operations
          const prepareCellOperation = (cell, text) => {
            // Always clear existing content in the cell, even if it appears empty
            // This ensures we remove any corrupted text that might be there
            if (cell.content && cell.content.length > 0) {
              const firstPara = cell.content[0];
              const lastPara = cell.content[cell.content.length - 1];
              const deleteStart = firstPara.startIndex || cell.startIndex + 1;
              const deleteEnd = (lastPara.endIndex || cell.endIndex) - 1;
              if (deleteEnd > deleteStart) {
                // Extract cell text to check for corruption
                const cellText = cell.content
                  .map(para => para.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
                  .join('');
                if (cellText && cellText.trim().length > 0) {
                  deleteRequests.push({
                    deleteContentRange: {
                      range: {
                        startIndex: deleteStart,
                        endIndex: deleteEnd
                      }
                    }
                  });
                }
              }
            } else {
              // Even if cell.content is empty, check if there's text in the cell
              // by trying to delete from startIndex+1 to endIndex-1
              const deleteStart = cell.startIndex + 1;
              const deleteEnd = cell.endIndex - 1;
              if (deleteEnd > deleteStart) {
                // Try to clear the cell anyway to be safe
                deleteRequests.push({
                  deleteContentRange: {
                    range: {
                      startIndex: deleteStart,
                      endIndex: deleteEnd
                    }
                  }
                });
              }
            }
            // Store cell and text for later insertion
            cellsToFill.push({ cell, text });
          };

          // Prepare header row operations
          if (tableRows_actual.length > 0) {
            const headerRow = tableRows_actual[0];
            const headerCells = headerRow.tableCells || [];
            
            // Header cell 1: Time Slot
            if (headerCells.length > 0) {
              prepareCellOperation(headerCells[0], 'Time Slot');
            }
            
            // Header cell 2: Task Description
            if (headerCells.length > 1) {
              prepareCellOperation(headerCells[1], 'Task Description');
            }
          }

          // Prepare time slot rows operations
          for (let i = 0; i < slots.length && i + 1 < tableRows_actual.length; i++) {
            const row = tableRows_actual[i + 1];
            const cells = row.tableCells || [];
            
            if (cells.length > 0) {
              prepareCellOperation(cells[0], slots[i]);
            }
          }

          // Execute deletions first
          if (deleteRequests.length > 0) {
            console.log(`[GoogleDriveService] Clearing ${deleteRequests.length} corrupted cell(s)`);
            await this.docs.documents.batchUpdate({
              documentId,
              requestBody: { requests: deleteRequests }
            });
            // Refresh document after deletions
            const docAfterDelete = await this.docs.documents.get({ documentId });
            const tableAfterDelete = docAfterDelete.data.body.content.find(el => el.table && el.startIndex >= insertIndex);
            if (tableAfterDelete && tableAfterDelete.table) {
              // Update cell references with fresh indices
              const freshTable = tableAfterDelete.table;
              const freshRows = freshTable.tableRows || [];
              cellsToFill.forEach((op, idx) => {
                // Find corresponding cell in fresh table
                let targetCell = null;
                if (idx === 0 && freshRows.length > 0) {
                  targetCell = freshRows[0].tableCells?.[0];
                } else if (idx === 1 && freshRows.length > 0) {
                  targetCell = freshRows[0].tableCells?.[1];
                } else if (idx >= 2 && freshRows.length > idx - 1) {
                  targetCell = freshRows[idx - 1].tableCells?.[0];
                }
                if (targetCell) {
                  op.cell = targetCell;
                }
              });
            }
          }

          // Now insert text into cleared cells
          const insertRequests = cellsToFill.map(op => ({
            insertText: {
              location: { index: op.cell.startIndex + 1 },
              text: op.text
            }
          }));

          if (insertRequests.length > 0) {
            console.log(`[GoogleDriveService] Inserting text into ${insertRequests.length} cell(s)`);
            await this.docs.documents.batchUpdate({
              documentId,
              requestBody: { requests: insertRequests }
            });
          }
          
          // Return the end index of this table for next table insertion
          return tableElement.endIndex;
        }
        
        return insertIndex;
      };

      // Create a single table with all time slots (AM + PM)
      const allSlots = [...amSlots, ...pmSlots];
      await createAndFillTable(allSlots, currentInsertIndex);

      return { success: true, alreadyHasTable: false };
    } catch (error) {
      throw new Error(`Failed to update template with hourly table: ${error.message}`);
    }
  }

  /**
   * Gets document text content
   * @param {string} documentId - Document ID
   * @returns {Promise<string>} Document text
   */
  async getDocumentText(documentId) {
    await this._initializeAPIs();
    try {
      const doc = await this.docs.documents.get({
        documentId
      });

      let text = '';
      if (doc.data.body && doc.data.body.content) {
        doc.data.body.content.forEach(element => {
          if (element.paragraph && element.paragraph.elements) {
            element.paragraph.elements.forEach(elem => {
              if (elem.textRun && elem.textRun.content) {
                text += elem.textRun.content;
              }
            });
          }
        });
      }

      return text;
    } catch (error) {
      throw new Error(`Failed to get document text: ${error.message}`);
    }
  }

  /**
   * Insert item into ToDo list section
   * @param {string} documentId - Document ID
   * @param {string} todoItem - ToDo item text (e.g., "Go to grocery store #14_Nov_2025_14_25")
   * @returns {Promise<Object>} Success result
   */
  async insertIntoToDoList(documentId, todoItem) {
    await this._initializeAPIs();
    try {
      const doc = await this.docs.documents.get({
        documentId
      });

      // Find the ToDo list section (look for "📋 To-Do List" or "To-Do List")
      const bodyContent = doc.data.body.content;
      let todoListIndex = -1;
      
      for (let i = 0; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });
          
          // Check if this is the ToDo list header
          if (paragraphText.includes('📋 To-Do List') || 
              paragraphText.toLowerCase().includes('to-do list') ||
              paragraphText.toLowerCase().includes('todo list')) {
            todoListIndex = i;
            break;
          }
        }
      }

      if (todoListIndex === -1) {
        throw new Error('ToDo list section not found in document');
      }

      // Find the insertion point (after the ToDo list header, before next section)
      // Look for the next section or use end of document
      let insertIndex = -1;
      for (let i = todoListIndex + 1; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });
          
          // Check if we hit another section (has emoji or specific headers)
          if (paragraphText.includes('🧠') || 
              paragraphText.includes('📝') || 
              paragraphText.includes('📊') ||
              paragraphText.includes('⏰') ||
              paragraphText.toLowerCase().includes('time slot')) {
            // Insert before this section
            insertIndex = element.startIndex;
            break;
          }
        }
      }

      // If no next section found, find the end of the last paragraph in ToDo section
      if (insertIndex === -1) {
        // Find the last paragraph before next major section
        for (let i = todoListIndex + 1; i < bodyContent.length; i++) {
          const element = bodyContent[i];
          if (element.paragraph) {
            insertIndex = element.endIndex - 1;
            // Continue until we find a non-empty paragraph or hit next section
            let hasText = false;
            if (element.paragraph.elements) {
              element.paragraph.elements.forEach(elem => {
                if (elem.textRun && elem.textRun.content && elem.textRun.content.trim()) {
                  hasText = true;
                }
              });
            }
            if (!hasText) {
              break; // Found empty paragraph, insert here
            }
          }
        }
      }

      // Default: insert after ToDo header
      if (insertIndex === -1) {
        const todoHeader = bodyContent[todoListIndex];
        insertIndex = todoHeader.endIndex - 1;
      }

      // Insert the ToDo item
      await this.docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: insertIndex
                },
                text: `- ${todoItem}\n`
              }
            }
          ]
        }
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to insert into ToDo list: ${error.message}`);
    }
  }

  /**
   * Get only the To-Do List section text (for reminder scanning)
   * @param {string} documentId - Document ID
   * @returns {Promise<string>} Text of To-Do section only
   */
  async getToDoSectionText(documentId) {
    await this._initializeAPIs();
    try {
      const doc = await this.docs.documents.get({
        documentId
      });

      const bodyContent = doc.data.body.content;
      let todoListIndex = -1;

      // 1) Find the To-Do List header
      for (let i = 0; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });

          if (
            paragraphText.includes('📋 To-Do List') ||
            paragraphText.toLowerCase().includes('to-do list') ||
            paragraphText.toLowerCase().includes('todo list')
          ) {
            todoListIndex = i;
            break;
          }
        }
      }

      if (todoListIndex === -1) {
        // No To-Do section; nothing to scan
        return '';
      }

      // 2) Collect paragraphs from To-Do header down to (but not including) next major section
      const lines = [];
      for (let i = todoListIndex + 1; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });

          // Stop when we hit the next section header
          if (
            paragraphText.includes('🧠') || // Notes
            paragraphText.includes('📝') || // Free-form
            paragraphText.includes('📊') || // End of Day
            paragraphText.includes('⏰') || // Hourly Plan
            paragraphText.toLowerCase().includes('time slot')
          ) {
            break;
          }

          if (paragraphText.trim()) {
            lines.push(paragraphText.trim());
          }
        }
      }

      return lines.join('\n');
    } catch (error) {
      throw new Error(`Failed to read To-Do section: ${error.message}`);
    }
  }

  /**
   * Insert entry into Notes / Quick Logs section
   * @param {string} documentId - Document ID
   * @param {string} noteText - Note text to insert
   * @returns {Promise<Object>} Success result
   */
  async insertIntoNotes(documentId, noteText) {
    await this._initializeAPIs();
    try {
      const doc = await this.docs.documents.get({
        documentId
      });

      // Find the Notes section (look for "🧠 Notes" or "Notes / Quick Logs")
      const bodyContent = doc.data.body.content;
      let notesIndex = -1;
      
      for (let i = 0; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });
          
          if (paragraphText.includes('🧠 Notes') || 
              paragraphText.includes('Notes / Quick Logs') ||
              paragraphText.toLowerCase().includes('notes / quick logs')) {
            notesIndex = i;
            break;
          }
        }
      }

      if (notesIndex === -1) {
        // Fallback: append at end
        return await this.appendToDocument(documentId, noteText);
      }

      // Find insertion point (after Notes header, before next section)
      let insertIndex = -1;
      for (let i = notesIndex + 1; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });
          
          // Check if this is the next section
          if (paragraphText.includes('📝') || 
              paragraphText.includes('📊') ||
              paragraphText.includes('⏰') ||
              paragraphText.includes('📋')) {
            insertIndex = element.startIndex;
            break;
          }
        }
      }

      // Default: insert after Notes header
      if (insertIndex === -1) {
        const notesHeader = bodyContent[notesIndex];
        insertIndex = notesHeader.endIndex - 1;
      }

      // Insert the note
      await this.docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: insertIndex
                },
                text: `${noteText}\n`
              }
            }
          ]
        }
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to insert into Notes: ${error.message}`);
    }
  }

  /**
   * Insert entry into Free-form Journal section
   * @param {string} documentId - Document ID
   * @param {string} journalText - Journal entry text to insert
   * @returns {Promise<Object>} Success result
   */
  async insertIntoJournal(documentId, journalText) {
    await this._initializeAPIs();
    try {
      const doc = await this.docs.documents.get({
        documentId
      });

      // Find the Free-form Journal section (look for "📝 Free-form Journal")
      const bodyContent = doc.data.body.content;
      let journalIndex = -1;
      
      for (let i = 0; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });
          
          if (paragraphText.includes('📝 Free-form Journal') || 
              paragraphText.includes('Free-form Journal') ||
              paragraphText.toLowerCase().includes('free-form journal')) {
            journalIndex = i;
            break;
          }
        }
      }

      if (journalIndex === -1) {
        // Fallback: append at end
        return await this.appendToDocument(documentId, journalText);
      }

      // Find insertion point (after Journal header/description, before next section)
      let insertIndex = -1;
      for (let i = journalIndex + 1; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });
          
          // Check if this is the next section (Time Slot table or End of Day Analysis)
          if (paragraphText.includes('Time Slot') ||
              paragraphText.includes('Task Description') ||
              paragraphText.includes('📊') ||
              paragraphText.includes('⏰')) {
            insertIndex = element.startIndex;
            break;
          }
        }
      }

      // Default: insert after Journal header/description (skip the example text)
      if (insertIndex === -1) {
        // Find the paragraph after the example text
        for (let i = journalIndex + 1; i < bodyContent.length; i++) {
          const element = bodyContent[i];
          if (element.paragraph) {
            let paragraphText = '';
            if (element.paragraph.elements) {
              element.paragraph.elements.forEach(elem => {
                if (elem.textRun && elem.textRun.content) {
                  paragraphText += elem.textRun.content;
                }
              });
            }
            // Skip example text, insert after it
            if (!paragraphText.includes('Write anything here') && 
                !paragraphText.includes('Example:') &&
                paragraphText.trim().length === 0) {
              insertIndex = element.endIndex - 1;
              break;
            }
          }
        }
        
        // If still not found, insert after header
        if (insertIndex === -1) {
          const journalHeader = bodyContent[journalIndex];
          insertIndex = journalHeader.endIndex - 1;
        }
      }

      // Insert the journal entry
      await this.docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: insertIndex
                },
                text: `${journalText}\n\n`
              }
            }
          ]
        }
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to insert into Journal: ${error.message}`);
    }
  }

  /**
   * Search for reminder hashtags in document text
   * @param {string} documentText - Document text content
   * @param {string} targetDatePrefix - Date prefix to match (e.g., "14_Nov_2025")
   * @returns {Array<Object>} Array of reminder items with task and hashtag
   */
  findReminderHashtags(documentText, targetDatePrefix) {
    const reminders = [];
    
    // Pattern to match hashtags like #14_Nov_2025_14_25
    const hashtagPattern = new RegExp(`#${targetDatePrefix}_\\d{2}_\\d{2}`, 'g');
    const lines = documentText.split('\n');
    
    for (const line of lines) {
      const matches = line.match(hashtagPattern);
      if (matches) {
        // Extract task text (everything before the hashtag)
        const hashtag = matches[0];
        const taskMatch = line.match(/^[-•]\s*(.+?)\s*#/);
        if (taskMatch) {
          const task = taskMatch[1].trim();
          // Extract time from hashtag (format: #DD_Mon_YYYY_HH_MM)
          const timeMatch = hashtag.match(/_(\d{2})_(\d{2})$/);
          if (timeMatch) {
            reminders.push({
              task,
              hashtag,
              hour: parseInt(timeMatch[1], 10),
              minute: parseInt(timeMatch[2], 10)
            });
          }
        }
      }
    }
    
    return reminders;
  }

  /**
   * Find all journals in a folder within date range
   * @param {string} folderId - Folder ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array<Object>>} Array of journal documents
   */
  async findJournalsInDateRange(folderId, startDate, endDate) {
    await this._initializeAPIs();
    try {
      const journals = [];
      let pageToken = null;
      
      do {
        const query = `'${folderId}' in parents and name contains 'Journal -' and trashed=false`;
        const response = await this.drive.files.list({
          q: query,
          fields: 'nextPageToken, files(id, name, createdTime)',
          pageSize: 100,
          pageToken: pageToken
        });

        if (response.data.files) {
          for (const file of response.data.files) {
            // Extract date from filename "Journal - YYYY-MM-DD"
            const dateMatch = file.name.match(/Journal - (\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              const fileDate = new Date(dateMatch[1] + 'T00:00:00');
              if (fileDate >= startDate && fileDate <= endDate) {
                journals.push({
                  id: file.id,
                  name: file.name,
                  date: dateMatch[1]
                });
              }
            }
          }
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      return journals;
    } catch (error) {
      throw new Error(`Failed to find journals in date range: ${error.message}`);
    }
  }

  /**
   * Insert End of Day Analysis into journal document
   * @param {string} documentId - Document ID
   * @param {Object} analysis - Analysis object with whatWentWell, whatDidntGoWell, productivityScore, mentalPhysicalState, improvements
   * @returns {Promise<Object>} Success result
   */
  async insertEndOfDayAnalysis(documentId, analysis) {
    await this._initializeAPIs();
    try {
      const doc = await this.docs.documents.get({
        documentId
      });

      // Find the End of Day Analysis section
      const bodyContent = doc.data.body.content;
      let analysisIndex = -1;
      
      for (let i = 0; i < bodyContent.length; i++) {
        const element = bodyContent[i];
        if (element.paragraph && element.paragraph.elements) {
          let paragraphText = '';
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun && elem.textRun.content) {
              paragraphText += elem.textRun.content;
            }
          });
          
          if (paragraphText.includes('📊 End of Day Analysis') || 
              paragraphText.includes('End of Day Analysis') ||
              paragraphText.toLowerCase().includes('end of day analysis')) {
            analysisIndex = i;
            break;
          }
        }
      }

      if (analysisIndex === -1) {
        throw new Error('End of Day Analysis section not found in document');
      }

      // Build replacement requests for each section
      // We'll use a more flexible approach: find the section and replace content after it
      const requests = [];
      
      // Get document text to find exact positions
      const docText = await this.getDocumentText(documentId);
      const lines = docText.split('\n');
      
      // Find section indices
      let whatWentWellIndex = -1;
      let whatDidntGoWellIndex = -1;
      let productivityScoreIndex = -1;
      let mentalPhysicalStateIndex = -1;
      let improvementsIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('🎯 What went well') && whatWentWellIndex === -1) {
          whatWentWellIndex = i;
        } else if (line.includes('🚫 What didn') && line.includes('go well') && whatDidntGoWellIndex === -1) {
          whatDidntGoWellIndex = i;
        } else if (line.includes('📈 Productivity Score') && productivityScoreIndex === -1) {
          productivityScoreIndex = i;
        } else if (line.includes('🧠 Mental/Physical State') && mentalPhysicalStateIndex === -1) {
          mentalPhysicalStateIndex = i;
        } else if (line.includes('🌱 What to improve tomorrow') && improvementsIndex === -1) {
          improvementsIndex = i;
        }
      }
      
      // Use replaceAllText for each section (more reliable than index-based)
      // Replace "🎯 What went well" and content until next section
      if (whatWentWellIndex >= 0) {
        requests.push({
          replaceAllText: {
            containsText: {
              text: '🎯 What went well',
              matchCase: false
            },
            replaceText: `🎯 What went well\n\n${analysis.whatWentWell}\n`
          }
        });
      }

      // Replace "🚫 What didn't go well" section
      if (whatDidntGoWellIndex >= 0) {
        requests.push({
          replaceAllText: {
            containsText: {
              text: '🚫 What didn',
              matchCase: false
            },
            replaceText: `🚫 What didn't go well\n\n${analysis.whatDidntGoWell}\n`
          }
        });
      }

      // Replace "📈 Productivity Score" section
      if (productivityScoreIndex >= 0) {
        requests.push({
          replaceAllText: {
            containsText: {
              text: '📈 Productivity Score',
              matchCase: false
            },
            replaceText: `📈 Productivity Score (1–10): ${analysis.productivityScore}\n`
          }
        });
      }

      // Replace "🧠 Mental/Physical State" section
      if (mentalPhysicalStateIndex >= 0) {
        requests.push({
          replaceAllText: {
            containsText: {
              text: '🧠 Mental/Physical State',
              matchCase: false
            },
            replaceText: `🧠 Mental/Physical State:\n\n${analysis.mentalPhysicalState}\n`
          }
        });
      }

      // Replace "🌱 What to improve tomorrow" section
      if (improvementsIndex >= 0) {
        requests.push({
          replaceAllText: {
            containsText: {
              text: '🌱 What to improve tomorrow',
              matchCase: false
            },
            replaceText: `🌱 What to improve tomorrow:\n\n${analysis.improvements}\n`
          }
        });
      }

      // Execute all replacements
      await this.docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: requests
        }
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to insert End of Day Analysis: ${error.message}`);
    }
  }
}

module.exports = {
  GoogleDriveService
};

