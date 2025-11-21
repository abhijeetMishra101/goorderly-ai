#!/usr/bin/env node

/**
 * Create a brand-new Google Doc template with proper table structure
 * and update the Templates table to point to it.
 *
 * Usage:
 *   node scripts/create-default-template.js <user-email>
 */

const { sequelize } = require('../src/database/db');
const { User, Template } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');
const { templateContent } = require('../src/database/seeders/001_seed_template');

async function main() {
  const userEmail = process.argv[2];
  if (!userEmail) {
    console.error('❌ Usage: node scripts/create-default-template.js <user-email>');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const user = await User.findOne({ where: { email: userEmail } });
    if (!user) {
      throw new Error(`User with email ${userEmail} not found`);
    }

    const template = await Template.findOne({ where: { isActive: true }, order: [['id', 'ASC']] });
    if (!template) {
      throw new Error('No active template found in the database');
    }

    console.log(`👤 Using user ${user.email} (ID ${user.id}) to create the template doc`);

    const driveService = new GoogleDriveService(user);
    await driveService._initializeAPIs();

    console.log('📄 Copying reference document...');
    const referenceDocId = '1OqWfQaxC_-O9ytlKFqPqMaCGpQl9N4dPhZzmA5cZPM8';
    
    // Copy the reference document
    const copyResponse = await driveService.drive.files.copy({
      fileId: referenceDocId,
      requestBody: {
        name: 'GoOrderly Template - Daily Journal'
      }
    });

    const documentId = copyResponse.data.id;
    console.log(`✅ Copied reference document to ${documentId}`);

    // The reference document already has the correct structure, so we just verify it
    console.log('✅ Verifying copied document structure...');
    
    // Get the document to verify it has the table
    const doc = await driveService.docs.documents.get({ documentId });
    
    // Find the table
    const tableEl = doc.data.body.content.find(el => el.table);
    if (!tableEl || !tableEl.table) {
      throw new Error('Copied document does not have a table');
    }
    
    console.log(`✅ Found table with ${tableEl.table.tableRows?.length || 0} rows`);
    console.log('✅ Template copied successfully - using reference document as-is');

    console.log(`✅ Created doc ${documentId} with proper table structure`);

    await template.update({ googleDocId: documentId });
    console.log(`💾 Updated Template#${template.id} (${template.name}) to use doc ${documentId}`);
    console.log(`🔗 Template URL: https://docs.google.com/document/d/${documentId}/edit`);

    console.log('🎉 All done! The template now has proper table structure.');
  } catch (error) {
    console.error('❌ Failed to create default template:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
