#!/usr/bin/env node

/**
 * Delete old template and create a completely fresh one from scratch
 * This creates a brand new Google Doc and builds it step by step
 */

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function createFreshTemplate(userIdentifier) {
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

    // Step 1: Delete old template document
    if (oldTemplateDocId && oldTemplateDocId !== 'PLACEHOLDER_WILL_BE_CREATED_ON_USER_SELECTION') {
      try {
        console.log('🗑️  Deleting old template document...');
        await driveService.drive.files.delete({
          fileId: oldTemplateDocId
        });
        console.log('✓ Old template deleted\n');
      } catch (error) {
        console.log(`⚠️  Could not delete old template (might already be deleted): ${error.message}\n`);
      }
    }

    // Step 2: Create brand new empty Google Doc
    console.log('📄 Creating brand new Google Doc...');
    const createResponse = await driveService.docs.documents.create({
      requestBody: {
        title: 'GoOrderly Template - Daily Journal'
      }
    });

    const newTemplateDocId = createResponse.data.documentId;
    console.log(`✓ Created new document: ${newTemplateDocId}\n`);

    // Step 3: Get the document (it has one empty paragraph)
    const doc = await driveService.docs.documents.get({ documentId: newTemplateDocId });
    const insertIndex = 1; // Start after the initial newline

    // Step 4: Insert content before table
    console.log('📝 Inserting content before Hourly Plan...');
    const beforeTable = `🗓️ Daily Journal – {DATE}\n\n⏰ Hourly Plan\n\n`;
    await driveService.docs.documents.batchUpdate({
      documentId: newTemplateDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: insertIndex },
            text: beforeTable
          }
        }]
      }
    });

    // Step 5: Refresh to get current index
    let currentDoc = await driveService.docs.documents.get({ documentId: newTemplateDocId });
    let currentIndex = 1;
    if (currentDoc.data.body.content && currentDoc.data.body.content.length > 0) {
      const lastElement = currentDoc.data.body.content[currentDoc.data.body.content.length - 1];
      currentIndex = lastElement.endIndex || currentIndex;
    }

    // Step 6: Create the hourly plan table
    console.log('📊 Creating hourly plan table...');
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

    // Insert a newline before table to ensure valid insertion point
    await driveService.docs.documents.batchUpdate({
      documentId: newTemplateDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: currentIndex - 1 },
            text: '\n'
          }
        }]
      }
    });

    // Refresh to get updated index
    currentDoc = await driveService.docs.documents.get({ documentId: newTemplateDocId });
    if (currentDoc.data.body.content && currentDoc.data.body.content.length > 0) {
      const lastElement = currentDoc.data.body.content[currentDoc.data.body.content.length - 1];
      currentIndex = lastElement.endIndex || currentIndex;
    }

    // Create table at currentIndex - 1 to ensure valid insertion
    const tableInsertIndex = currentIndex > 1 ? currentIndex - 1 : currentIndex;
    await driveService.docs.documents.batchUpdate({
      documentId: newTemplateDocId,
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
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 7: Fill the table - get fresh document
    console.log('✏️  Filling table cells...');
    currentDoc = await driveService.docs.documents.get({ documentId: newTemplateDocId });
    const tableEl = currentDoc.data.body.content.find(el => el.table && el.startIndex >= tableInsertIndex);
    
    if (!tableEl || !tableEl.table) {
      throw new Error('Table was not created');
    }

    const table = tableEl.table;
    const rows = table.tableRows || [];
    
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
      await driveService.docs.documents.batchUpdate({
        documentId: newTemplateDocId,
        requestBody: { requests: insertRequests }
      });
      console.log(`✓ Filled ${insertRequests.length} cells\n`);
    }

    // Step 8: Insert content after table
    console.log('📝 Inserting content after Hourly Plan...');
    currentDoc = await driveService.docs.documents.get({ documentId: newTemplateDocId });
    const afterTableIndex = tableEl.endIndex || currentIndex;
    
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

    await driveService.docs.documents.batchUpdate({
      documentId: newTemplateDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: afterTableIndex },
            text: '\n\n' + afterTable
          }
        }]
      }
    });

    // Step 9: Update database
    console.log('💾 Updating database...');
    await userTemplate.Template.update({
      googleDocId: newTemplateDocId
    });
    console.log('✓ Database updated\n');

    console.log('✅ Template completely recreated from scratch!');
    console.log(`🔗 Template URL: https://docs.google.com/document/d/${newTemplateDocId}/edit`);
    console.log('\n🎉 All done! The template is fresh and clean.');

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
  console.error('Usage: node scripts/create-fresh-template.js <user-email-or-id>');
  process.exit(1);
}

createFreshTemplate(userIdentifier);

