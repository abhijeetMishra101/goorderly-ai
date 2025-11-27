#!/usr/bin/env node

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function checkDocument(userIdentifier) {
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
    
    // Check all content for corruption
    console.log('Checking document for corruption...\n');
    let foundCorruption = false;
    
    for (const element of doc.data.body.content) {
      if (element.paragraph && element.paragraph.elements) {
        const text = element.paragraph.elements.map(e => e.textRun?.content || '').join('');
        if (text.includes('TiTas') || text.match(/12:001:00/)) {
          console.log(`❌ Found corruption in paragraph at index ${element.startIndex}:`);
          console.log(`   "${text.substring(0, 100)}..."\n`);
          foundCorruption = true;
        }
      }
    }
    
    if (!foundCorruption) {
      console.log('✅ No corruption found in document paragraphs');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

checkDocument(process.argv[2]);

