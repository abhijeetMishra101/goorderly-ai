// src/database/seeders/001_seed_template.js

const { sequelize } = require('../db');
const Template = require('../../models/template');

const templateContent = `🗓️ Daily Journal – {DATE}

⏰ Hourly Plan

📋 To-Do List #office #personal #health

🧠 Notes / Quick Logs

📝 Free-form Journal (tag people/topics using #hashtag)

Write anything here. Tag relevant people or topics inline using #e.g. #Andrew, #FocusTime, #Feedback.

📊 End of Day Analysis

🎯 What went well

🚫 What didn't go well

- 

📈 Productivity Score (1–10): 

🧠 Mental/Physical State:

Example: Alert morning, post-lunch slump

🌱 What to improve tomorrow:

- `;

async function seedTemplate() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established for seeding.');

    // Check if template already exists
    const existingTemplate = await Template.findOne({
      where: { name: 'Daily Journal Template' }
    });

    if (existingTemplate) {
      console.log('Template already exists, updating content...');
      // Update existing template with new content
      await existingTemplate.update({
        contentPreview: templateContent,
        isActive: true
      });
      console.log('Template updated successfully:', existingTemplate.toJSON());
      return;
    }

    // Create template
    // Note: google_doc_id will be created when user selects this template
    // The template content is stored in contentPreview for display/creation
    const template = await Template.create({
      name: 'Daily Journal Template',
      description: 'Comprehensive daily journal template with hourly planning, to-do lists, notes, and end-of-day analysis.',
      googleDocId: 'PLACEHOLDER_WILL_BE_CREATED_ON_USER_SELECTION',
      contentPreview: templateContent,
      isActive: true
    });

    console.log('Template seeded successfully:', template.toJSON());
  } catch (error) {
    console.error('Error seeding template:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedTemplate()
    .then(() => {
      console.log('Seed completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

module.exports = { seedTemplate, templateContent };
