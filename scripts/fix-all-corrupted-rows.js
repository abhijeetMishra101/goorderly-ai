#!/usr/bin/env node

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function fixAllCorruptedRows(userIdentifier) {
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
    
    // Find and fix all corrupted rows
    const corruptedRows = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.tableCells || [];
      if (cells.length > 0) {
        const cell = cells[0];
        const cellText = cell.content
          ?.map(para => para.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
          .join('') || '';
        
        // Check if cell has corruption
        if (cellText.includes('TiTas') || cellText.match(/12:001:00/) || cellText.match(/1:00 2:00 3:00/)) {
          corruptedRows.push({ rowIndex: i, cell, expectedText: i === 0 ? 'Time Slot' : allSlots[i - 1] });
        }
      }
    }
    
    if (corruptedRows.length === 0) {
      console.log('✅ No corrupted rows found!');
      process.exit(0);
    }
    
    console.log(`Found ${corruptedRows.length} corrupted row(s), fixing...\n`);
    
    // Fix each corrupted row one at a time
    for (const { rowIndex, cell, expectedText } of corruptedRows) {
      try {
        // Clear corrupted content
        if (cell.content && cell.content.length > 0) {
          const firstPara = cell.content[0];
          const lastPara = cell.content[cell.content.length - 1];
          const deleteStart = firstPara.startIndex || cell.startIndex + 1;
          const deleteEnd = (lastPara.endIndex || cell.endIndex) - 1;
          
          if (deleteEnd > deleteStart) {
            await driveService.docs.documents.batchUpdate({
              documentId: userTemplate.Template.googleDocId,
              requestBody: {
                requests: [{
                  deleteContentRange: {
                    range: { startIndex: deleteStart, endIndex: deleteEnd }
                  }
                }]
              }
            });
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Refresh to get updated cell index
            const freshDoc = await driveService.docs.documents.get({ documentId: userTemplate.Template.googleDocId });
            const freshTableEl = freshDoc.data.body.content.find(el => el.table);
            if (freshTableEl && freshTableEl.table) {
              const freshRows = freshTableEl.table.tableRows || [];
              if (rowIndex < freshRows.length) {
                const freshRow = freshRows[rowIndex];
                const freshCells = freshRow.tableCells || [];
                if (freshCells.length > 0) {
                  const freshCell = freshCells[0];
                  // Insert correct text
                  await driveService.docs.documents.batchUpdate({
                    documentId: userTemplate.Template.googleDocId,
                    requestBody: {
                      requests: [{
                        insertText: {
                          location: { index: freshCell.startIndex + 1 },
                          text: expectedText
                        }
                      }]
                    }
                  });
                  console.log(`✓ Fixed Row ${rowIndex}: "${expectedText}"`);
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`⚠️  Could not fix Row ${rowIndex}: ${error.message}`);
      }
    }
    
    console.log('\n✅ All corrupted rows fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixAllCorruptedRows(process.argv[2]);

