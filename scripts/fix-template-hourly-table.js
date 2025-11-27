#!/usr/bin/env node

/**
 * Script to fix the hourly plan table in a user's Google Doc template
 * 
 * Usage:
 *   node scripts/fix-template-hourly-table.js <user-email-or-id>
 * 
 * Example:
 *   node scripts/fix-template-hourly-table.js user@example.com
 *   node scripts/fix-template-hourly-table.js 1
 */

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function fixTemplateHourlyTable(userIdentifier) {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✓ Database connected');

    // Find user by email or ID
    let user;
    if (isNaN(userIdentifier)) {
      // Assume it's an email
      user = await User.findOne({ where: { email: userIdentifier } });
      if (!user) {
        throw new Error(`User with email "${userIdentifier}" not found`);
      }
    } else {
      // Assume it's an ID
      user = await User.findByPk(parseInt(userIdentifier));
      if (!user) {
        throw new Error(`User with ID "${userIdentifier}" not found`);
      }
    }

    console.log(`✓ Found user: ${user.name || user.email} (ID: ${user.id})`);

    // Get user's selected template
    const userTemplate = await UserTemplate.findOne({
      where: {
        user_id: user.id,
        is_selected: true
      },
      include: [
        {
          model: Template,
          as: 'Template',
          required: true
        }
      ]
    });

    if (!userTemplate || !userTemplate.Template) {
      throw new Error('User has no selected template');
    }

    const template = userTemplate.Template;
    const templateDocId = template.googleDocId;

    if (!templateDocId || templateDocId === 'PLACEHOLDER_WILL_BE_CREATED_ON_USER_SELECTION') {
      throw new Error('Template does not have a valid Google Doc ID');
    }

    console.log(`✓ Found template: "${template.name}" (Google Doc ID: ${templateDocId})`);

    // Initialize Google Drive Service with user
    console.log('\nInitializing Google Drive Service...');
    const driveService = new GoogleDriveService(user);

    // Fix the template
    console.log('\nFixing hourly plan table in template...');
    console.log('This will:');
    console.log('  1. Delete all existing tables in the template');
    console.log('  2. Recreate a clean hourly plan table with proper header and time slots');
    console.log('');

    await driveService.updateTemplateWithHourlyTable(templateDocId);

    console.log('✓ Template hourly plan table fixed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Delete today\'s journal document from Google Drive (if it exists)');
    console.log('  2. Create a new journal from the app - it will use the fixed template');
    console.log('  3. The new journal should have a clean hourly plan table');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Get user identifier from command line
const userIdentifier = process.argv[2];

if (!userIdentifier) {
  console.error('Usage: node scripts/fix-template-hourly-table.js <user-email-or-id>');
  console.error('\nExample:');
  console.error('  node scripts/fix-template-hourly-table.js user@example.com');
  console.error('  node scripts/fix-template-hourly-table.js 1');
  process.exit(1);
}

fixTemplateHourlyTable(userIdentifier);


