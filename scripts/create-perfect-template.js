#!/usr/bin/env node

/**
 * Create a perfect template with exact content as specified
 * This script is very careful and methodical to avoid any corruption
 */

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function createPerfectTemplate(userIdentifier) {
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

    const oldTemplateDocId = userTemplate.Template.googleDocId;
    console.log(`Old Template Doc ID: ${oldTemplateDocId}\n`);

    const driveService = new GoogleDriveService(user);
    await driveService._initializeAPIs();

    // Step 1: Delete old template
    if (oldTemplateDocId && oldTemplateDocId !== 'PLACEHOLDER_WILL_BE_CREATED_ON_USER_SELECTION') {
      try {
        console.log('🗑️  Deleting old template...');
        await driveService.drive.files.delete({ fileId: oldTemplateDocId });
        console.log('✓ Deleted\n');
      } catch (error) {
        console.log(`⚠️  Could not delete (might already be deleted): ${error.message}\n`);
      }
    }

    // Step 2: Create brand new empty document
    console.log('📄 Creating new document...');
    const createResponse = await driveService.docs.documents.create({
      requestBody: { title: 'GoOrderly Template - Daily Journal' }
    });
    const newDocId = createResponse.data.documentId;
    console.log(`✓ Created: ${newDocId}\n`);

    // Step 3: Insert content before table
    console.log('📝 Inserting content before Hourly Plan...');
    const beforeTable = `🗓️ Daily Journal – {DATE}\n\n📋 To-Do List #office #personal #health\n\n🧠 Notes / Quick Logs\n\n📝 Free-form Journal (tag people/topics using #hashtag)\n\nWrite anything here. Tag relevant people or topics inline using #e.g. #Andrew, #FocusTime, #Feedback.\n\n⏰ Hourly Plan\n\n`;
    
    await driveService.docs.documents.batchUpdate({
      documentId: newDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: 1 },
            text: beforeTable
          }
        }]
      }
    });

    // Step 4: Get current index
    let doc = await driveService.docs.documents.get({ documentId: newDocId });
    let insertIndex = 1;
    if (doc.data.body.content && doc.data.body.content.length > 0) {
      const lastEl = doc.data.body.content[doc.data.body.content.length - 1];
      insertIndex = lastEl.endIndex || insertIndex;
    }

    // Step 5: Create table (25 rows: 1 header + 24 time slots)
    console.log('📊 Creating table...');
    await driveService.docs.documents.batchUpdate({
      documentId: newDocId,
      requestBody: {
        requests: [{
          insertTable: {
            location: { index: insertIndex - 1 },
            rows: 25,
            columns: 2
          }
        }]
      }
    });

    // Wait for table to be fully created
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Get fresh document and find table
    doc = await driveService.docs.documents.get({ documentId: newDocId });
    const tableEl = doc.data.body.content.find(el => el.table);
    if (!tableEl || !tableEl.table) {
      throw new Error('Table was not created');
    }

    const table = tableEl.table;
    const rows = table.tableRows || [];
    console.log(`✓ Table created with ${rows.length} rows\n`);

    // Step 7: Clear ALL cells first (one at a time, from end to start)
    console.log('🧹 Clearing all cells...');
    const cellsToClear = [];
    for (const row of rows) {
      const cells = row.tableCells || [];
      for (const cell of cells) {
        if (cell.content && cell.content.length > 0) {
          const firstPara = cell.content[0];
          const lastPara = cell.content[cell.content.length - 1];
          const start = firstPara.startIndex || cell.startIndex + 1;
          const end = (lastPara.endIndex || cell.endIndex) - 1;
          if (end > start) {
            cellsToClear.push({ start, end });
          }
        }
      }
    }

    // Sort by end index descending
    cellsToClear.sort((a, b) => b.end - a.end);

    // Clear one at a time
    for (const range of cellsToClear) {
      try {
        await driveService.docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: {
            requests: [{
              deleteContentRange: {
                range: { startIndex: range.start, endIndex: range.end }
              }
            }]
          }
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore errors - cell might already be empty
      }
    }
    console.log(`✓ Cleared ${cellsToClear.length} cells\n`);

    // Step 8: Wait and refresh document
    await new Promise(resolve => setTimeout(resolve, 1000));
    doc = await driveService.docs.documents.get({ documentId: newDocId });
    const freshTableEl = doc.data.body.content.find(el => el.table);
    if (!freshTableEl || !freshTableEl.table) {
      throw new Error('Table disappeared');
    }
    const freshRows = freshTableEl.table.tableRows || [];

    // Step 9: Insert text into cells (one at a time to avoid issues)
    console.log('✏️  Filling cells...');
    const timeSlots = [
      '12:00 - 1:00 AM', '1:00 - 2:00 AM', '2:00 - 3:00 AM', '3:00 - 4:00 AM',
      '4:00 - 5:00 AM', '5:00 - 6:00 AM', '6:00 - 7:00 AM', '7:00 - 8:00 AM',
      '8:00 - 9:00 AM', '9:00 - 10:00 AM', '10:00 - 11:00 AM', '11:00AM - 12:00 PM',
      '12:00-1:00 PM', '1:00-2:00 PM', '2:00-3:00 PM', '3:00-4:00 PM',
      '4:00-5:00 PM', '5:00-6:00 PM', '6:00-7:00 PM', '7:00-8:00 PM',
      '8:00-9:00 PM', '9:00-10:00 PM', '10:00-11:00 PM', '11:00 PM -12:00 AM'
    ];

    // Header row
    if (freshRows.length > 0) {
      const headerRow = freshRows[0];
      const headerCells = headerRow.tableCells || [];
      
      if (headerCells.length > 0) {
        await driveService.docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: headerCells[0].startIndex + 1 },
                text: 'Time Slot'
              }
            }]
          }
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (headerCells.length > 1) {
        await driveService.docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: headerCells[1].startIndex + 1 },
                text: 'Task Description'
              }
            }]
          }
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Time slot rows - insert one at a time
    for (let i = 0; i < timeSlots.length && i + 1 < freshRows.length; i++) {
      // Refresh document before each insertion to get fresh indices
      doc = await driveService.docs.documents.get({ documentId: newDocId });
      const currentTableEl = doc.data.body.content.find(el => el.table);
      if (!currentTableEl || !currentTableEl.table) break;
      
      const currentRows = currentTableEl.table.tableRows || [];
      if (i + 1 >= currentRows.length) break;
      
      const row = currentRows[i + 1];
      const cells = row.tableCells || [];
      
      if (cells.length > 0) {
        await driveService.docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: cells[0].startIndex + 1 },
                text: timeSlots[i]
              }
            }]
          }
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    console.log('✓ All cells filled\n');

    // Step 10: Insert content after table
    console.log('📝 Inserting content after Hourly Plan...');
    doc = await driveService.docs.documents.get({ documentId: newDocId });
    const finalTableEl = doc.data.body.content.find(el => el.table);
    const afterTableIndex = finalTableEl ? finalTableEl.endIndex : insertIndex;
    
    const afterTable = `📊 End of Day Analysis\n\n🎯 What went well\n\n🚫 What didn't go well\n\n- \n\n📈 Productivity Score (1–10): \n\n🧠 Mental/Physical State:\n\nExample: Alert morning, post-lunch slump\n\n🌱 What to improve tomorrow:\n\n- `;

    await driveService.docs.documents.batchUpdate({
      documentId: newDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: afterTableIndex },
            text: '\n\n' + afterTable
          }
        }]
      }
    });

    // Step 11: Update database
    console.log('💾 Updating database...');
    await userTemplate.Template.update({ googleDocId: newDocId });
    console.log('✓ Database updated\n');

    console.log('✅ Perfect template created!');
    console.log(`🔗 Template URL: https://docs.google.com/document/d/${newDocId}/edit`);
    console.log('\n🎉 All done! The template is clean and perfect.');

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
  console.error('Usage: node scripts/create-perfect-template.js <user-email-or-id>');
  process.exit(1);
}

createPerfectTemplate(userIdentifier);

