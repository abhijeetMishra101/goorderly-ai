#!/usr/bin/env node

/**
 * Script to check template content and provide Drive link
 * 
 * Usage:
 *   node scripts/check-template.js <user-email-or-id>
 */

const { sequelize } = require('../src/database/db');
const { User, Template, UserTemplate } = require('../src/models');
const { GoogleDriveService } = require('../src/services/googleDriveService');

async function checkTemplate(userIdentifier) {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    // Find user by email or ID
    let user;
    if (isNaN(userIdentifier)) {
      user = await User.findOne({ where: { email: userIdentifier } });
      if (!user) {
        throw new Error(`User with email "${userIdentifier}" not found`);
      }
    } else {
      user = await User.findByPk(parseInt(userIdentifier));
      if (!user) {
        throw new Error(`User with ID "${userIdentifier}" not found`);
      }
    }

    console.log(`✓ Found user: ${user.name || user.email} (ID: ${user.id})\n`);

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

    console.log(`✓ Template: "${template.name}"`);
    console.log(`✓ Google Doc ID: ${templateDocId}`);
    console.log(`\n🔗 Template URL: https://docs.google.com/document/d/${templateDocId}/edit\n`);

    // Initialize Google Drive Service
    console.log('Checking template content...\n');
    const driveService = new GoogleDriveService(user);
    await driveService._initializeAPIs();

    // Get the document
    const doc = await driveService.docs.documents.get({ documentId: templateDocId });
    
    // Extract text content
    const bodyText = doc.data.body.content
      .map(el => {
        if (el.paragraph && el.paragraph.elements) {
          return el.paragraph.elements.map(e => e.textRun?.content || '').join('');
        }
        if (el.table) {
          return '[TABLE]';
        }
        return '';
      })
      .join('');

    // Check for corruption - look for common corruption patterns
    const corruptionPatterns = [
      'TiTas',
      'k Descriptionme Slot',
      'Descriptionme Slot',
      'me Slot',
      /12:001:00.*2:00.*3:00/, // Corrupted time slots without spaces
      /PM.*AM.*PM/, // Mixed AM/PM without proper formatting
    ];
    
    let hasCorruption = false;
    let corruptionDetails = [];
    
    for (const pattern of corruptionPatterns) {
      if (pattern instanceof RegExp) {
        if (pattern.test(bodyText)) {
          hasCorruption = true;
          corruptionDetails.push(`Pattern match: ${pattern}`);
        }
      } else {
        if (bodyText.includes(pattern)) {
          hasCorruption = true;
          corruptionDetails.push(`Contains: "${pattern}"`);
        }
      }
    }
    
    const hasTable = doc.data.body.content.some(el => el.table);
    const tableCount = doc.data.body.content.filter(el => el.table).length;

    console.log('Template Status:');
    console.log(`  - Has table: ${hasTable ? '✅ Yes' : '❌ No'} (${tableCount} table(s))`);
    console.log(`  - Has corruption: ${hasCorruption ? '❌ YES - CORRUPTED' : '✅ No'}`);
    if (hasCorruption && corruptionDetails.length > 0) {
      console.log(`  - Corruption details: ${corruptionDetails.join(', ')}`);
    }
    
    // Find hourly plan section and show more context
    const hourlyPlanIndex = bodyText.indexOf('⏰ Hourly Plan');
    if (hourlyPlanIndex === -1) {
      console.log(`  - Hourly Plan section: ❌ Not found`);
    } else {
      const afterHourlyPlan = bodyText.substring(hourlyPlanIndex, hourlyPlanIndex + 500);
      console.log(`  - Hourly Plan section: ✅ Found`);
      console.log(`  - Content after "⏰ Hourly Plan" (first 200 chars):`);
      console.log(`    "${afterHourlyPlan.substring(0, 200)}"`);
      
      // Check if there's corrupted text in this section
      const hourlyPlanSection = bodyText.substring(hourlyPlanIndex);
      const nextSectionIndex = hourlyPlanSection.search(/📋|🧠|📝|📊/);
      const hourlyPlanContent = nextSectionIndex > 0 
        ? hourlyPlanSection.substring(0, nextSectionIndex)
        : hourlyPlanSection;
      
      if (hourlyPlanContent.includes('TiTas') || hourlyPlanContent.match(/12:001:00/)) {
        console.log(`  - ⚠️  WARNING: Corruption detected in Hourly Plan section!`);
        console.log(`  - Raw content length: ${hourlyPlanContent.length} chars`);
      }
    }

    console.log('\n📋 Next steps:');
    if (hasCorruption || !hasTable) {
      console.log('  1. Run: node scripts/fix-template-hourly-table.js ' + (isNaN(userIdentifier) ? userIdentifier : user.id));
      console.log('  2. Or delete the template from Drive and let auto-recovery recreate it');
    } else {
      console.log('  Template looks good! If journals are still corrupted, delete and recreate them.');
    }

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
  console.error('Usage: node scripts/check-template.js <user-email-or-id>');
  console.error('\nExample:');
  console.error('  node scripts/check-template.js user@example.com');
  console.error('  node scripts/check-template.js 1');
  process.exit(1);
}

checkTemplate(userIdentifier);

