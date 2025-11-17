// src/services/userOnboardingService.js

// Import models from index to ensure associations are set up
const { UserTemplate, Template, User } = require('../models');
const { GoogleAppsScriptService } = require('./googleAppsScriptService');
const { GoogleDriveService } = require('./googleDriveService');

class UserOnboardingService {
  /**
   * Check onboarding status for user
   * Auto-selects the single template if not already selected
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Onboarding status
   */
  async getOnboardingStatus(userId) {
    try {
      let selectedTemplate = await UserTemplate.findOne({
        where: {
          user_id: userId,
          is_selected: true
        },
        include: [
          {
            model: Template,
            as: 'Template',
            required: false
          }
        ]
      });

      // If no template selected, auto-select the single active template
      if (!selectedTemplate) {
        const activeTemplate = await Template.findOne({
          where: { isActive: true }
        });

        if (activeTemplate) {
          // Auto-select the template
          const [userTemplate] = await UserTemplate.findOrCreate({
            where: {
              user_id: userId,
              template_id: activeTemplate.id
            },
            defaults: {
              userId,
              templateId: activeTemplate.id,
              isSelected: true,
              journalFolderName: 'Daily Journals',
              journalTimeHour: 6,
              journalTimeMinute: 0
            }
          });

          // If it already existed, update it
          if (!userTemplate.isSelected) {
            await userTemplate.update({ isSelected: true });
          }

          // Reload with template
          selectedTemplate = await UserTemplate.findOne({
            where: {
              user_id: userId,
              is_selected: true
            },
            include: [
              {
                model: Template,
                as: 'Template',
                required: false
              }
            ]
          });
        }
      }

      return {
        isComplete: !!selectedTemplate && !!selectedTemplate.Template,
        selectedTemplate: selectedTemplate && selectedTemplate.Template ? {
          id: selectedTemplate.Template.id,
          name: selectedTemplate.Template.name,
          journalFolderName: selectedTemplate.journalFolderName,
          journalTimeHour: selectedTemplate.journalTimeHour,
          journalTimeMinute: selectedTemplate.journalTimeMinute,
          appsScriptId: selectedTemplate.appsScriptId,
          appsScriptWebappUrl: selectedTemplate.appsScriptWebappUrl
        } : null
      };
    } catch (error) {
      throw new Error(`Failed to check onboarding status: ${error.message}`);
    }
  }

  /**
   * Select template for user
   * @param {number} userId - User ID
   * @param {number} templateId - Template ID
   * @returns {Promise<Object>} UserTemplate association
   */
  async selectTemplate(userId, templateId) {
    try {
      // Verify template exists and is active
      const template = await Template.findByPk(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      if (!template.isActive) {
        throw new Error('Template is not active');
      }

      // Unselect any previously selected template
      await UserTemplate.update(
        { isSelected: false },
        { where: { user_id: userId, is_selected: true } }
      );

      // Find or create user-template association
      const [userTemplate, created] = await UserTemplate.findOrCreate({
        where: {
          user_id: userId,
          template_id: templateId
        },
        defaults: {
          userId,
          templateId,
          isSelected: false // Will be set to true in confirm step
        }
      });

      // Update if it already existed
      if (!created) {
        userTemplate.isSelected = false; // Reset for confirmation
        await userTemplate.save();
      }

      return userTemplate;
    } catch (error) {
      throw new Error(`Failed to select template: ${error.message}`);
    }
  }

  /**
   * Confirm template selection, save preferences, and create Apps Script
   * @param {number} userId - User ID
   * @param {number} templateId - Template ID
   * @param {Object} preferences - User preferences
   * @returns {Promise<Object>} Confirmed UserTemplate with Apps Script info
   */
  async confirmTemplateSelection(userId, templateId, preferences = {}) {
    try {
      const userTemplate = await UserTemplate.findOne({
        where: {
          user_id: userId,
          template_id: templateId
        },
        include: [
          {
            model: Template,
            as: 'Template',
            required: false // Make optional first to debug
          }
        ]
      });

      if (!userTemplate) {
        throw new Error('Template selection not found. Please select a template first.');
      }

      if (!userTemplate.Template) {
        throw new Error(`Template with ID ${templateId} not found or is not active.`);
      }

      // Get user for Apps Script creation
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // If template doesn't have a Google Doc yet, create it from template content
      let templateDocId = userTemplate.Template.googleDocId;
      if (!templateDocId || templateDocId === 'PLACEHOLDER_WILL_BE_CREATED_ON_USER_SELECTION' || templateDocId === 'PLACEHOLDER_TEMPLATE_DOC_ID') {
        try {
          const driveService = new GoogleDriveService(user);
          const templateDoc = await driveService.createDocumentFromText(
            `GoOrderly Template - ${userTemplate.Template.name}`,
            userTemplate.Template.contentPreview || ''
          );
          
          templateDocId = templateDoc.id;
          
          // Update template with the created Google Doc ID
          await userTemplate.Template.update({
            googleDocId: templateDocId
          });
          
          // Reload template to get updated googleDocId
          await userTemplate.Template.reload();
        } catch (docError) {
          console.error('Failed to create template Google Doc:', docError);
          throw new Error(`Failed to create template document: ${docError.message}`);
        }
      } else {
        // Template document exists - check if it needs the hourly table
        try {
          const driveService = new GoogleDriveService(user);
          await driveService.updateTemplateWithHourlyTable(templateDocId);
          console.log('[UserOnboardingService] Updated existing template with hourly table');
        } catch (updateError) {
          console.warn('[UserOnboardingService] Failed to update template with hourly table:', updateError.message);
          // Don't fail onboarding if update fails - template might already have table or be in use
        }
      }

      // Unselect all other templates
      await UserTemplate.update(
        { isSelected: false },
        {
          where: {
            user_id: userId,
            template_id: { [require('sequelize').Op.ne]: templateId }
          }
        }
      );

      // Update with preferences and mark as selected
      await userTemplate.update({
        isSelected: true,
        journalFolderName: preferences.journalFolderName || 'Daily Journals',
        journalTimeHour: preferences.journalTimeHour || 6,
        journalTimeMinute: preferences.journalTimeMinute || 0
      });

      // Create Apps Script for user
      try {
        const appsScriptService = new GoogleAppsScriptService(user);
        const scriptInfo = await appsScriptService.createUserScript({
          templateId: templateDocId, // Use the created/updated Google Doc ID
          journalFolderName: userTemplate.journalFolderName,
          journalTimeHour: userTemplate.journalTimeHour,
          journalTimeMinute: userTemplate.journalTimeMinute,
          llmApiUrl: process.env.LLM_API_URL || ''
        });

        // Save Apps Script info
        await userTemplate.update({
          appsScriptId: scriptInfo.scriptId,
          appsScriptWebappUrl: scriptInfo.webAppUrl,
          appsScriptDeploymentId: scriptInfo.deploymentId
        });
      } catch (scriptError) {
        console.error('Failed to create Apps Script:', scriptError);
        // Don't fail onboarding if Apps Script creation fails
        // User can retry later or we can handle it separately
      }

      return userTemplate;
    } catch (error) {
      throw new Error(`Failed to confirm template selection: ${error.message}`);
    }
  }

  /**
   * Get user's selected template
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} UserTemplate with Template
   */
  async getUserSelectedTemplate(userId) {
    try {
      const userTemplate = await UserTemplate.findOne({
        where: {
          user_id: userId,
          is_selected: true
        },
        include: [
          {
            model: Template,
            as: 'Template',
            required: false
          }
        ]
      });

      return userTemplate;
    } catch (error) {
      throw new Error(`Failed to get user selected template: ${error.message}`);
    }
  }
}

module.exports = new UserOnboardingService();
