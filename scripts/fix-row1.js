#!/usr/bin/env node

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function fixRow1(userIdentifier) {
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
    
    const row1 = tableEl.table.tableRows?.[1];
    if (!row1 || !row1.tableCells || row1.tableCells.length === 0) throw new Error('No row 1');
    
    const cell = row1.tableCells[0];
    const cellText = cell.content?.map(para => para.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '').join('') || '';
    
    if (cellText.includes('12:001:00')) {
      // Clear corrupted content
      const firstPara = cell.content[0];
      const lastPara = cell.content[cell.content.length - 1];
      const deleteStart = firstPara.startIndex || cell.startIndex + 1;
      const deleteEnd = (lastPara.endIndex || cell.endIndex) - 1;
      
      await driveService.docs.documents.batchUpdate({
        documentId: userTemplate.Template.googleDocId,
        requestBody: {
          requests: [
            {
              deleteContentRange: {
                range: { startIndex: deleteStart, endIndex: deleteEnd }
              }
            },
            {
              insertText: {
                location: { index: cell.startIndex + 1 },
                text: '12:00 - 1:00 AM'
              }
            }
          ]
        }
      });
      console.log('✅ Row 1 fixed!');
    } else {
      console.log('✅ Row 1 is already correct');
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixRow1(process.argv[2]);

