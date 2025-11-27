#!/usr/bin/env node

/**
 * Script to populate empty time slot cells in the template table
 * WITHOUT deleting and recreating the table
 */

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function populateTable(userIdentifier) {
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

    const doc = await driveService.docs.documents.get({ documentId: templateDocId });
    
    // Find the table
    const tableEl = doc.data.body.content.find(el => el.table);
    if (!tableEl || !tableEl.table) {
      console.log('❌ No table found');
      return;
    }

    const table = tableEl.table;
    let rows = table.tableRows || [];
    console.log(`Found table with ${rows.length} rows\n`);

    // Time slots
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

    const requests = [];

    // Fix header row
    if (rows.length > 0) {
      const headerRow = rows[0];
      const headerCells = headerRow.tableCells || [];
      
      // Header cell 0: Time Slot - clear if corrupted, then insert
      if (headerCells.length > 0) {
        const cell = headerCells[0];
        const cellText = cell.content
          ?.map(para => para.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
          .join('') || '';
        
        if (cellText.includes('TiTas') || cellText.trim() !== 'Time Slot') {
          // Clear corrupted content
          if (cell.content && cell.content.length > 0) {
            const firstPara = cell.content[0];
            const lastPara = cell.content[cell.content.length - 1];
            const deleteStart = firstPara.startIndex || cell.startIndex + 1;
            const deleteEnd = (lastPara.endIndex || cell.endIndex) - 1;
            if (deleteEnd > deleteStart) {
              requests.push({
                deleteContentRange: {
                  range: { startIndex: deleteStart, endIndex: deleteEnd }
                }
              });
            }
          }
          // Insert correct text
          requests.push({
            insertText: {
              location: { index: cell.startIndex + 1 },
              text: 'Time Slot'
            }
          });
        }
      }
      
      // Header cell 1: Task Description
      if (headerCells.length > 1) {
        const cell = headerCells[1];
        const cellText = cell.content
          ?.map(para => para.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
          .join('') || '';
        
        if (cellText.trim() !== 'Task Description') {
          // Clear if needed
          if (cell.content && cell.content.length > 0) {
            const firstPara = cell.content[0];
            const lastPara = cell.content[cell.content.length - 1];
            const deleteStart = firstPara.startIndex || cell.startIndex + 1;
            const deleteEnd = (lastPara.endIndex || cell.endIndex) - 1;
            if (deleteEnd > deleteStart) {
              requests.push({
                deleteContentRange: {
                  range: { startIndex: deleteStart, endIndex: deleteEnd }
                }
              });
            }
          }
          // Insert correct text
          requests.push({
            insertText: {
              location: { index: cell.startIndex + 1 },
              text: 'Task Description'
            }
          });
        }
      }
    }

    // Execute deletions first if any
    if (requests.length > 0) {
      console.log(`Clearing ${requests.length} cell(s)...\n`);
      await driveService.docs.documents.batchUpdate({
        documentId: templateDocId,
        requestBody: { requests }
      });
      // Refresh document after deletions
      const docAfterDelete = await driveService.docs.documents.get({ documentId: templateDocId });
      const tableAfterDelete = docAfterDelete.data.body.content.find(el => el.table);
      if (tableAfterDelete && tableAfterDelete.table) {
        rows = tableAfterDelete.table.tableRows || [];
      }
    }

    // Now populate time slot rows (rows 1-24)
    // Refresh document to get fresh cell indices
    const docForInsert = await driveService.docs.documents.get({ documentId: templateDocId });
    const tableForInsert = docForInsert.data.body.content.find(el => el.table);
    if (!tableForInsert || !tableForInsert.table) {
      throw new Error('Table not found after refresh');
    }
    rows = tableForInsert.table.tableRows || [];
    
    const insertRequests = [];
    for (let i = 0; i < allSlots.length && i + 1 < rows.length; i++) {
      const row = rows[i + 1];
      const cells = row.tableCells || [];
      
      if (cells.length > 0) {
        const cell = cells[0];
        const cellText = cell.content
          ?.map(para => para.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
          .join('') || '';
        
        // Clear cell first if it has any content (even whitespace)
        if (cell.content && cell.content.length > 0 && cellText.trim().length > 0) {
          const firstPara = cell.content[0];
          const lastPara = cell.content[cell.content.length - 1];
          const deleteStart = firstPara.startIndex || cell.startIndex + 1;
          const deleteEnd = (lastPara.endIndex || cell.endIndex) - 1;
          if (deleteEnd > deleteStart) {
            insertRequests.push({
              deleteContentRange: {
                range: { startIndex: deleteStart, endIndex: deleteEnd }
              }
            });
          }
        }
        
        // Always insert the time slot text
        insertRequests.push({
          insertText: {
            location: { index: cell.startIndex + 1 },
            text: allSlots[i]
          }
        });
      }
    }

    if (insertRequests.length > 0) {
      console.log(`Populating ${insertRequests.length} time slot cell(s)...\n`);
      await driveService.docs.documents.batchUpdate({
        documentId: templateDocId,
        requestBody: { requests: insertRequests }
      });
      console.log('✅ Template table populated successfully!');
    } else if (requests.length === 0) {
      console.log('✅ Template table is already complete!');
    } else {
      console.log('✅ Template table cleared, but no cells needed population!');
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

const userIdentifier = process.argv[2];
if (!userIdentifier) {
  console.error('Usage: node scripts/populate-template-table.js <user-email-or-id>');
  process.exit(1);
}

populateTable(userIdentifier);

