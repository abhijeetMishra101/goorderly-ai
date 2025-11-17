// src/services/googleAppsScriptService.js

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const googleAuthService = require('./googleAuthService');

/**
 * Service for creating and managing Google Apps Scripts for users
 */
class GoogleAppsScriptService {
  constructor(user) {
    this.user = user;
    this.auth = null;
    this.scriptsAPI = null;
  }

  /**
   * Initialize Google Apps Script API with user's OAuth tokens
   * @private
   */
  async _initializeAPI() {
    if (this.user && !this.auth) {
      const oauth2Client = await googleAuthService.getOAuth2ClientForUser(this.user);
      this.auth = oauth2Client;
    }

    if (!this.auth) {
      throw new Error('Authentication required. Provide user object.');
    }

    this.scriptsAPI = google.script('v1', { auth: this.auth });
  }

  /**
   * Create Apps Script for user with their preferences
   * @param {Object} preferences - User preferences
   * @returns {Promise<Object>} Created script info
   */
  async createUserScript(preferences) {
    await this._initializeAPI();

    try {
      // Load template
      const template = this._loadTemplate();

      // Inject user preferences
      const scriptCode = this._injectPreferences(template, {
        templateId: preferences.templateId,
        journalFolderName: preferences.journalFolderName,
        journalTimeHour: preferences.journalTimeHour,
        journalTimeMinute: preferences.journalTimeMinute,
        llmApiUrl: preferences.llmApiUrl || process.env.LLM_API_URL || ''
      });

      // Create script project
      const createResponse = await this.scriptsAPI.projects.create({
        requestBody: {
          title: 'GoOrderly Journal Automation'
        }
      });

      const scriptId = createResponse.data.scriptId;

      // Update script content
      await this.scriptsAPI.projects.updateContent({
        scriptId,
        requestBody: {
          files: [{
            name: 'Code',
            type: 'SERVER_JS',
            source: scriptCode
          }]
        }
      });

      // Deploy as web app
      const deployResponse = await this.scriptsAPI.projects.deploy({
        scriptId,
        requestBody: {
          versionNumber: 1,
          description: 'GoOrderly Journal Automation Script',
          manifestFileName: 'appsscript'
        }
      });

      const deploymentId = deployResponse.data.deploymentId;
      const webAppUrl = deployResponse.data.entryPoints?.[0]?.webApp?.url || '';

      // Execute setup function to create triggers
      await this.scriptsAPI.scripts.run({
        scriptId,
        requestBody: {
          function: 'setupTriggersStartingTomorrow'
        }
      });

      // Also setup analysis triggers
      await this.scriptsAPI.scripts.run({
        scriptId,
        requestBody: {
          function: 'setupAnalysisTriggers'
        }
      });

      return {
        scriptId,
        webAppUrl,
        deploymentId
      };
    } catch (error) {
      throw new Error(`Failed to create Apps Script: ${error.message}`);
    }
  }

  /**
   * Load Apps Script template
   * @private
   * @returns {string} Template content
   */
  _loadTemplate() {
    const templatePath = path.join(__dirname, '../../apps_script/template.gs');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    return fs.readFileSync(templatePath, 'utf8');
  }

  /**
   * Inject user preferences into template
   * @private
   * @param {string} template - Template content
   * @param {Object} preferences - User preferences
   * @returns {string} Injected template
   */
  _injectPreferences(template, preferences) {
    let injected = template;

    // Replace placeholders
    injected = injected.replace(/{{TEMPLATE_DOC_ID}}/g, preferences.templateId || '');
    injected = injected.replace(/{{JOURNAL_FOLDER_NAME}}/g, preferences.journalFolderName || 'Daily Journals');
    injected = injected.replace(/{{JOURNAL_TIME_HOUR}}/g, preferences.journalTimeHour || 6);
    injected = injected.replace(/{{JOURNAL_TIME_MINUTE}}/g, preferences.journalTimeMinute || 0);
    injected = injected.replace(/{{LLM_API_URL}}/g, preferences.llmApiUrl || '');

    return injected;
  }

  /**
   * Get script information
   * @param {string} scriptId - Script ID
   * @returns {Promise<Object>} Script info
   */
  async getScriptInfo(scriptId) {
    await this._initializeAPI();

    try {
      const response = await this.scriptsAPI.projects.get({
        scriptId
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get script info: ${error.message}`);
    }
  }

  /**
   * Delete user's Apps Script
   * @param {string} scriptId - Script ID
   * @returns {Promise<void>}
   */
  async deleteScript(scriptId) {
    await this._initializeAPI();

    try {
      // Note: Apps Script API doesn't have direct delete
      // We need to delete via Drive API
      const drive = google.drive({ version: 'v3', auth: this.auth });
      await drive.files.delete({
        fileId: scriptId
      });
    } catch (error) {
      throw new Error(`Failed to delete script: ${error.message}`);
    }
  }
}

module.exports = GoogleAppsScriptService;

