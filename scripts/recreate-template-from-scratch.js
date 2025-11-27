#!/usr/bin/env node

/**
 * Script to completely recreate the template from scratch
 * This deletes ALL content and rebuilds it with the correct structure
 */

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');
const { templateContent } = require('../src/database/seeders/001_seed_template');

async function recreateTemplate(userIdentifier) {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    let user;
    if (isNaN(userIdentifier)) {
      user = await User.findOne({ where: { email: userIdentifier } });
    } else {
      user = await User.findByPk(parseInt(userIdentifier));
    }

    if (!user) {
      throw new Error(`User not found`);
    }

    const userTemplate = await UserTemplate.findOne({
      where: { user_id: user.id, is_selected: true },
      include: [{ model: Template, as: 'Template', required: true }]
    });

    if (!userTemplate || !userTemplate.Template) {
      throw new Error('User has no selected template');
    }

    const templateDocId = userTemplate.Template.googleDocId;
    console.log(`Template Doc ID: ${templateDocId}\n`);

    const driveService = new GoogleDriveService(user);
    await driveService._initializeAPIs();

    // Get the document
    const doc = await driveService.docs.documents.get({ documentId: templateDocId });
    
    // Delete ALL content from the document
    // Find the actual end index of the document body
    const body = doc.data.body;
    let deleteEnd = 1;
    if (body.content && body.content.length > 0) {
      // Find the last element's end index
      for (const element of body.content) {
        if (element.endIndex && element.endIndex > deleteEnd) {
          deleteEnd = element.endIndex;
        }
      }
      // Delete from start (after the document's initial newline at index 1) to end
      const deleteStart = 1;
      // The end index should be one less than the actual end to avoid deleting the final newline
      const actualDeleteEnd = deleteEnd > 1 ? deleteEnd - 1 : deleteEnd;
      
      if (actualDeleteEnd > deleteStart) {
        console.log(`Deleting all content from index ${deleteStart} to ${actualDeleteEnd}...\n`);
        await driveService.docs.documents.batchUpdate({
          documentId: templateDocId,
          requestBody: {
            requests: [{
              deleteContentRange: {
                range: {
                  startIndex: deleteStart,
                  endIndex: actualDeleteEnd
                }
              }
            }]
          }
        });
        console.log('✓ All content deleted\n');
        // Wait a moment for deletion to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Refresh document
    const emptyDoc = await driveService.docs.documents.get({ documentId: templateDocId });
    const insertIndex = 1;

    // Build the template content in the correct order
    const beforeTable = `🗓️ Daily Journal – {DATE}\n\n⏰ Hourly Plan\n\n`;
    const afterTable = `📋 To-Do List #office #personal #health

🧠 Notes / Quick Logs

📝 Free-form Journal (tag people/topics using #hashtag)

Write anything here. Tag relevant people or topics inline using #e.g. #Andrew, #FocusTime, #Feedback.

📊 End of Day Analysis

🎯 What went well

🚫 What didn't go well

- 

📈 Productivity Score (1–10): 

🧠 Mental/Physical State:

Example: Alert morning, post-lunch slump

🌱 What to improve tomorrow:

- `;

    // Insert content before "⏰ Hourly Plan" and the table
    console.log('Inserting content before Hourly Plan...');
    await driveService.docs.documents.batchUpdate({
      documentId: templateDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: insertIndex },
            text: beforeTable
          }
        }]
      }
    });

    // Refresh to get current index after insertion
    let currentDoc = await driveService.docs.documents.get({ documentId: templateDocId });
    let currentIndex = 1;
    // Find the last element's end index
    if (currentDoc.data.body.content && currentDoc.data.body.content.length > 0) {
      const lastElement = currentDoc.data.body.content[currentDoc.data.body.content.length - 1];
      currentIndex = lastElement.endIndex || currentIndex;
    }

    // Insert a newline to create a valid insertion point for the table
    // Google Docs requires the insertion index to be less than the end index
    await driveService.docs.documents.batchUpdate({
      documentId: templateDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: currentIndex - 1 },
            text: '\n'
          }
        }]
      }
    });

    // Refresh again to get the updated index
    currentDoc = await driveService.docs.documents.get({ documentId: templateDocId });
    if (currentDoc.data.body.content && currentDoc.data.body.content.length > 0) {
      const lastElement = currentDoc.data.body.content[currentDoc.data.body.content.length - 1];
      currentIndex = lastElement.endIndex || currentIndex;
    }

    // Create the hourly plan table
    console.log('Creating hourly plan table...');
    const amSlots = [
      '12:00 - 1:00 AM', '1:00 - 2:00 AM', '2:00 - 3:00 AM', '3:00 - 4:00 AM',
      '4:00 - 5:00 AM', '5:00 - 6:00 AM', '6:00 - 7:00 AM', '7:00 - 8:00 AM',
      '8:00 - 9:00 AM', '9:00 - 10:00 AM', '10:00 - 11:00 AM', '11:00AM - 12:00 PM'
    ];
    const pmSlots = [
      '12:00-1:00 PM', '1:00-2:00 PM', '2:00-3:00 PM', '3:00-4:00 PM',
      '4:00-5:00 PM', '5:00-6:00 PM', '6:00-7:00 PM', '7:00-8:00 PM',
      '8:00-9:00 PM', '9:00-10:00 PM', '10:00-11:00 PM', '11:00 PM -12:00 AM'
    ];
    const allSlots = [...amSlots, ...pmSlots];
    const tableRows = allSlots.length + 1; // +1 for header

    // Create table - use currentIndex - 1 to ensure it's before the end index
    const tableInsertIndex = currentIndex > 1 ? currentIndex - 1 : currentIndex;
    await driveService.docs.documents.batchUpdate({
      documentId: templateDocId,
      requestBody: {
        requests: [{
          insertTable: {
            location: { index: tableInsertIndex },
            rows: tableRows,
            columns: 2
          }
        }]
      }
    });

    // Wait for table to be created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Refresh and fill the table
    currentDoc = await driveService.docs.documents.get({ documentId: templateDocId });
    const tableEl = currentDoc.data.body.content.find(el => el.table && el.startIndex >= tableInsertIndex);
    
    if (!tableEl || !tableEl.table) {
      throw new Error('Table was not created');
    }

    const table = tableEl.table;
    let rows = table.tableRows || [];
    const fillRequests = [];

    // First, clear ALL cells in the table to remove any corruption
    console.log('Clearing all table cells...');
    const clearRequests = [];
    for (const row of rows) {
      const cells = row.tableCells || [];
      for (const cell of cells) {
        if (cell.content && cell.content.length > 0) {
          const firstPara = cell.content[0];
          const lastPara = cell.content[cell.content.length - 1];
          const deleteStart = firstPara.startIndex || cell.startIndex + 1;
          const deleteEnd = (lastPara.endIndex || cell.endIndex) - 1;
          if (deleteEnd > deleteStart) {
            clearRequests.push({
              deleteContentRange: {
                range: { startIndex: deleteStart, endIndex: deleteEnd }
              }
            });
          }
        }
      }
    }
    
    if (clearRequests.length > 0) {
      await driveService.docs.documents.batchUpdate({
        documentId: templateDocId,
        requestBody: { requests: clearRequests }
      });
      console.log(`✓ Cleared ${clearRequests.length} cell(s)\n`);
      // Refresh document after clearing
      currentDoc = await driveService.docs.documents.get({ documentId: templateDocId });
      const tableAfterClear = currentDoc.data.body.content.find(el => el.table && el.startIndex >= tableInsertIndex);
      if (tableAfterClear && tableAfterClear.table) {
        rows = tableAfterClear.table.tableRows || [];
      }
    }

    // Now fill header row
    if (rows.length > 0) {
      const headerRow = rows[0];
      const headerCells = headerRow.tableCells || [];
      if (headerCells.length > 0) {
        fillRequests.push({
          insertText: {
            location: { index: headerCells[0].startIndex + 1 },
            text: 'Time Slot'
          }
        });
      }
      if (headerCells.length > 1) {
        fillRequests.push({
          insertText: {
            location: { index: headerCells[1].startIndex + 1 },
            text: 'Task Description'
          }
        });
      }
    }

    // Fill time slot rows
    for (let i = 0; i < allSlots.length && i + 1 < rows.length; i++) {
      const row = rows[i + 1];
      const cells = row.tableCells || [];
      if (cells.length > 0) {
        fillRequests.push({
          insertText: {
            location: { index: cells[0].startIndex + 1 },
            text: allSlots[i]
          }
        });
      }
    }

    // After clearing, rebuild fill requests with fresh cell indices
    if (rows.length > 0) {
      // Refresh document to get fresh cell indices after clearing
      currentDoc = await driveService.docs.documents.get({ documentId: templateDocId });
      const tableAfterClear = currentDoc.data.body.content.find(el => el.table && el.startIndex >= tableInsertIndex);
      if (tableAfterClear && tableAfterClear.table) {
        rows = tableAfterClear.table.tableRows || [];
      }
      
      // Build insert requests for all cells
      const insertRequests = [];
      
      // Header row
      if (rows.length > 0) {
        const headerRow = rows[0];
        const headerCells = headerRow.tableCells || [];
        if (headerCells.length > 0) {
          insertRequests.push({
            insertText: {
              location: { index: headerCells[0].startIndex + 1 },
              text: 'Time Slot'
            }
          });
        }
        if (headerCells.length > 1) {
          insertRequests.push({
            insertText: {
              location: { index: headerCells[1].startIndex + 1 },
              text: 'Task Description'
            }
          });
        }
      }
      
      // Time slot rows
      for (let i = 0; i < allSlots.length && i + 1 < rows.length; i++) {
        const row = rows[i + 1];
        const cells = row.tableCells || [];
        if (cells.length > 0) {
          insertRequests.push({
            insertText: {
              location: { index: cells[0].startIndex + 1 },
              text: allSlots[i]
            }
          });
        }
      }
      
      if (insertRequests.length > 0) {
        console.log(`Filling table with ${insertRequests.length} cell(s)...`);
        await driveService.docs.documents.batchUpdate({
          documentId: templateDocId,
          requestBody: { requests: insertRequests }
        });
      }
    }

    // Refresh to get index after table
    currentDoc = await driveService.docs.documents.get({ documentId: templateDocId });
    let afterTableIndex = tableEl.endIndex || currentIndex;

    // Insert content after table
    console.log('Inserting content after Hourly Plan...');
    await driveService.docs.documents.batchUpdate({
      documentId: templateDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: afterTableIndex },
            text: '\n\n' + afterTable
          }
        }]
      }
    });

    console.log('\n✅ Template completely recreated from scratch!');
    console.log(`🔗 Template URL: https://docs.google.com/document/d/${templateDocId}/edit`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

const userIdentifier = process.argv[2];
if (!userIdentifier) {
  console.error('Usage: node scripts/recreate-template-from-scratch.js <user-email-or-id>');
  process.exit(1);
}

recreateTemplate(userIdentifier);

