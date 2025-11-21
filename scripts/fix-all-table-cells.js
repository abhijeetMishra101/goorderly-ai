#!/usr/bin/env node

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function fixAllCells(userIdentifier) {
  try {
    await sequelize.authenticate();
    let user = isNaN(userIdentifier) 
      ? await User.findOne({ where: { email: userIdentifier } })
      : await User.findByPk(parseInt(userIdentifier));
    if (!user) throw new Error('User not found');

    const userTemplate = await UserTemplate.findOne({
      where: { user_id: user.id, is_selected: true },
      include: [{ model: Template, as: 'Template', required: true }]
    });
    if (!userTemplate || !userTemplate.Template) throw new Error('No template');

    const driveService = new GoogleDriveService(user);
    await driveService._initializeAPIs();
    const doc = await driveService.docs.documents.get({ documentId: userTemplate.Template.googleDocId });
    
    const tableEl = doc.data.body.content.find(el => el.table);
    if (!tableEl || !tableEl.table) throw new Error('No table');
    
    const rows = tableEl.table.tableRows || [];
    console.log(`Found table with ${rows.length} rows\n`);
    
    // Step 1: Clear ALL cells - delete one at a time from end to start
    console.log('Clearing all cells...');
    let cellsToClear = [];
    for (const row of rows) {
      const cells = row.tableCells || [];
      for (const cell of cells) {
        if (cell.content && cell.content.length > 0) {
          const firstPara = cell.content[0];
          const lastPara = cell.content[cell.content.length - 1];
          const deleteStart = firstPara.startIndex || cell.startIndex + 1;
          const deleteEnd = (lastPara.endIndex || cell.endIndex) - 1;
          if (deleteEnd > deleteStart) {
            cellsToClear.push({ startIndex: deleteStart, endIndex: deleteEnd });
          }
        }
      }
    }
    
    // Sort by endIndex descending to delete from end to start
    cellsToClear.sort((a, b) => b.endIndex - a.endIndex);
    
    // Delete one at a time
    for (const cellRange of cellsToClear) {
      try {
        await driveService.docs.documents.batchUpdate({
          documentId: userTemplate.Template.googleDocId,
          requestBody: {
            requests: [{
              deleteContentRange: {
                range: { startIndex: cellRange.startIndex, endIndex: cellRange.endIndex }
              }
            }]
          }
        });
        // Small delay between deletions
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Skip if deletion fails (might already be empty)
        console.log(`⚠️  Could not clear cell at ${cellRange.startIndex}-${cellRange.endIndex}: ${error.message}`);
      }
    }
    
    if (cellsToClear.length > 0) {
      console.log(`✓ Cleared ${cellsToClear.length} cells\n`);
      // Wait and refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 2: Refresh and get fresh cell indices
    const freshDoc = await driveService.docs.documents.get({ documentId: userTemplate.Template.googleDocId });
    const freshTableEl = freshDoc.data.body.content.find(el => el.table);
    if (!freshTableEl || !freshTableEl.table) throw new Error('Table disappeared');
    
    const freshRows = freshTableEl.table.tableRows || [];
    
    // Step 3: Build insert requests for all cells
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
    
    const insertRequests = [];
    
    // Header row
    if (freshRows.length > 0) {
      const headerRow = freshRows[0];
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
    for (let i = 0; i < allSlots.length && i + 1 < freshRows.length; i++) {
      const row = freshRows[i + 1];
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
    
    // Step 4: Insert all text at once
    if (insertRequests.length > 0) {
      console.log(`Inserting text into ${insertRequests.length} cells...`);
      await driveService.docs.documents.batchUpdate({
        documentId: userTemplate.Template.googleDocId,
        requestBody: { requests: insertRequests }
      });
      console.log('✅ All cells fixed!\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixAllCells(process.argv[2]);

