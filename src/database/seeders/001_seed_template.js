// src/database/seeders/001_seed_template.js

const { sequelize } = require('../db');
const Template = require('../../models/template');

const templateContent = `🗓️ Daily Journal – {DATE}

⏰ Hourly Plan

📋 To-Do List #office #personal #health

🧠 Notes / Quick Logs

📝 Free-form Journal (tag people/topics using #hashtag)

Write anything here. Tag relevant people or topics inline using #e.g. #Andrew, #FocusTime, #Feedback.

Time Slot

Task Description

12:00 - 1:00 AM

1:00 - 2:00 AM

2:00 - 3:00 AM

3:00 - 4:00 AM

4:00 - 5:00 AM

5:00 - 6:00 AM

7:00 - 8:00 AM

8:00 - 9:00 AM

9:00 - 10:00 AM

10:00 - 11:00 AM

11:00AM - 12:00 PM

12:00-1:00 PM

1:00-2:00 PM

2:00-3:00 PM

3:00-4:00 PM

4:00-5:00 PM

5:00-6:00 PM

6:00-7:00 PM

7:00-8:00 PM

8:00-9:00 PM

9:00-10:00 PM

10:00-11:00 PM

11:00 PM -12:00 AM

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

module.exports = { seedTemplate };
