#!/usr/bin/env node

/**
 * Script to inspect the table structure in a template
 */

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function inspectTemplate(userIdentifier) {
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

    console.log(`✅ Found table with ${tableEl.table.tableRows?.length || 0} rows\n`);

    // Inspect each row
    tableEl.table.tableRows?.forEach((row, rowIndex) => {
      console.log(`Row ${rowIndex}:`);
      row.tableCells?.forEach((cell, cellIndex) => {
        const cellText = cell.content
          ?.map(para => para.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
          .join('') || '';
        
        const hasCorruption = cellText.includes('TiTas') || cellText.match(/12:001:00/);
        const status = hasCorruption ? '❌ CORRUPTED' : '✅';
        console.log(`  Cell ${cellIndex}: ${status} "${cellText.substring(0, 50)}${cellText.length > 50 ? '...' : ''}"`);
        
        if (hasCorruption) {
          console.log(`    Full content: "${cellText}"`);
        }
      });
      console.log('');
    });

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
  console.error('Usage: node scripts/inspect-template-table.js <user-email-or-id>');
  process.exit(1);
}

inspectTemplate(userIdentifier);

