#!/usr/bin/env node

/**
 * Script to directly fix the corrupted header cell in a template
 */

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function fixHeaderCell(userIdentifier) {
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
    const headerRow = table.tableRows?.[0];
    if (!headerRow || !headerRow.tableCells || headerRow.tableCells.length === 0) {
      console.log('❌ No header row found');
      return;
    }

    const headerCell = headerRow.tableCells[0];
    console.log(`Found header cell at index ${headerCell.startIndex}\n`);

    // Get current cell content
    const cellText = headerCell.content
      ?.map(para => para.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
      .join('') || '';
    
    console.log(`Current cell content: "${cellText.substring(0, 100)}..."\n`);

    // Delete all content in the cell
    const requests = [];
    if (headerCell.content && headerCell.content.length > 0) {
      const firstPara = headerCell.content[0];
      const lastPara = headerCell.content[headerCell.content.length - 1];
      const deleteStart = firstPara.startIndex || headerCell.startIndex + 1;
      const deleteEnd = (lastPara.endIndex || headerCell.endIndex) - 1;
      
      if (deleteEnd > deleteStart) {
        console.log(`Deleting content from index ${deleteStart} to ${deleteEnd}`);
        requests.push({
          deleteContentRange: {
            range: {
              startIndex: deleteStart,
              endIndex: deleteEnd
            }
          }
        });
      }
    }

    // Insert correct header text
    const insertIdx = headerCell.startIndex + 1;
    console.log(`Inserting "Time Slot" at index ${insertIdx}`);
    requests.push({
      insertText: {
        location: { index: insertIdx },
        text: 'Time Slot'
      }
    });

    if (requests.length > 0) {
      await driveService.docs.documents.batchUpdate({
        documentId: templateDocId,
        requestBody: { requests }
      });
      console.log('\n✅ Header cell fixed!');
    } else {
      console.log('\n⚠️  No changes needed');
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
  console.error('Usage: node scripts/fix-template-header-cell.js <user-email-or-id>');
  process.exit(1);
}

fixHeaderCell(userIdentifier);

