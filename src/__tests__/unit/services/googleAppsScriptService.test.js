// src/__tests__/unit/services/googleAppsScriptService.test.js

const GoogleAppsScriptService = require('../../../services/googleAppsScriptService');
const fs = require('fs');
const path = require('path');

jest.mock('googleapis');
jest.mock('fs');
jest.mock('../../../services/googleAuthService', () => ({
  getOAuth2ClientForUser: jest.fn()
}));

describe('GoogleAppsScriptService', () => {
  let service;
  let mockUser;
  let mockScriptsAPI;
  let mockDriveAPI;
  let mockOAuth2Client;
  let googleAuthService;

  beforeEach(() => {
    mockUser = {
      id: 1,
      email: 'test@example.com',
      googleId: 'g123',
      refreshToken: 'refresh_token_123'
    };

    mockScriptsAPI = {
      projects: {
        create: jest.fn(),
        updateContent: jest.fn(),
        deploy: jest.fn(),
        get: jest.fn()
      },
      scripts: {
        run: jest.fn()
      }
    };

    mockDriveAPI = {
      files: {
        get: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    };

    mockOAuth2Client = {
      setCredentials: jest.fn(),
      refreshAccessToken: jest.fn()
    };

    const { google } = require('googleapis');
    google.script = jest.fn(() => mockScriptsAPI);
    google.drive = jest.fn(() => mockDriveAPI);

    // Mock googleAuthService
    googleAuthService = require('../../../services/googleAuthService');
    googleAuthService.getOAuth2ClientForUser = jest.fn().mockResolvedValue(mockOAuth2Client);

    // Mock fs.readFileSync for template loading
    const templatePath = path.join(__dirname, '../../../apps_script/template.gs');
    const templateContent = `const TEMPLATE_DOC_ID = 'PLACEHOLDER_TEMPLATE_DOC_ID';
const JOURNAL_FOLDER_NAME = 'Daily Journals';
const JOURNAL_TIME_HOUR = 6;
const JOURNAL_TIME_MINUTE = 0;
const LLM_API_URL = 'PLACEHOLDER_LLM_API_URL';`;
    
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readFileSync = jest.fn().mockReturnValue(templateContent);

    service = new GoogleAppsScriptService(mockUser);
  });

  describe('createUserScript', () => {
    it('should create Apps Script project with user preferences', async () => {
      const preferences = {
        templateId: 'TEMPLATE_ID_123',
        journalFolderName: 'Daily Journals',
        journalTimeHour: 6,
        journalTimeMinute: 0,
        llmApiUrl: 'https://xxx.ngrok.io'
      };

      mockScriptsAPI.projects.create.mockResolvedValue({
        data: { scriptId: 'SCRIPT_ID_123' }
      });

      mockScriptsAPI.projects.updateContent.mockResolvedValue({
        data: { scriptId: 'SCRIPT_ID_123', versionNumber: 1 }
      });

      mockScriptsAPI.projects.deploy.mockResolvedValue({
        data: {
          deploymentId: 'DEPLOY_ID_123',
          entryPoints: [{
            webApp: {
              url: 'https://script.google.com/macros/s/xxx/exec'
            }
          }]
        }
      });

      mockScriptsAPI.scripts.run.mockResolvedValue({
        data: { done: true }
      });

      const result = await service.createUserScript(preferences);

      expect(result).toHaveProperty('scriptId', 'SCRIPT_ID_123');
      expect(result).toHaveProperty('webAppUrl');
      expect(result).toHaveProperty('deploymentId', 'DEPLOY_ID_123');
      expect(mockScriptsAPI.projects.create).toHaveBeenCalled();
      expect(mockScriptsAPI.projects.updateContent).toHaveBeenCalled();
    });

    it('should inject user preferences into template', async () => {
      const preferences = {
        templateId: 'TEMPLATE_ID_123',
        journalFolderName: 'My Journals',
        journalTimeHour: 7,
        journalTimeMinute: 30,
        llmApiUrl: 'https://xxx.ngrok.io'
      };

      mockScriptsAPI.projects.create.mockResolvedValue({
        data: { scriptId: 'SCRIPT_ID_123' }
      });

      mockScriptsAPI.projects.updateContent.mockResolvedValue({
        data: { scriptId: 'SCRIPT_ID_123', versionNumber: 1 }
      });

      mockScriptsAPI.projects.deploy.mockResolvedValue({
        data: {
          deploymentId: 'DEPLOY_ID_123',
          entryPoints: [{
            webApp: {
              url: 'https://script.google.com/macros/s/xxx/exec'
            }
          }]
        }
      });

      mockScriptsAPI.scripts.run.mockResolvedValue({
        data: { done: true }
      });

      await service.createUserScript(preferences);

      const updateCall = mockScriptsAPI.projects.updateContent.mock.calls[0];
      const injectedCode = updateCall[0].requestBody.files[0].source;

      expect(injectedCode).toContain("const TEMPLATE_DOC_ID = 'TEMPLATE_ID_123'");
      expect(injectedCode).toContain("const JOURNAL_FOLDER_NAME = 'My Journals'");
      expect(injectedCode).toContain('const JOURNAL_TIME_HOUR = 7');
      expect(injectedCode).toContain('const JOURNAL_TIME_MINUTE = 30');
      expect(injectedCode).toContain("const LLM_API_URL = 'https://xxx.ngrok.io'");
    });

    it('should execute setup function after deployment', async () => {
      const preferences = {
        templateId: 'TEMPLATE_ID_123',
        journalFolderName: 'Daily Journals',
        journalTimeHour: 6,
        journalTimeMinute: 0,
        llmApiUrl: 'https://xxx.ngrok.io'
      };

      mockScriptsAPI.projects.create.mockResolvedValue({
        data: { scriptId: 'SCRIPT_ID_123' }
      });

      mockScriptsAPI.projects.updateContent.mockResolvedValue({
        data: { scriptId: 'SCRIPT_ID_123', versionNumber: 1 }
      });

      mockScriptsAPI.projects.deploy.mockResolvedValue({
        data: {
          deploymentId: 'DEPLOY_ID_123',
          entryPoints: [{
            webApp: {
              url: 'https://script.google.com/macros/s/xxx/exec'
            }
          }]
        }
      });

      mockScriptsAPI.scripts.run.mockResolvedValue({
        data: { done: true }
      });

      await service.createUserScript(preferences);

      expect(mockScriptsAPI.scripts.run).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptId: 'SCRIPT_ID_123',
          requestBody: expect.objectContaining({
            function: 'setupTriggersStartingTomorrow'
          })
        })
      );
    });
  });

  describe('_loadTemplate', () => {
    it('should load template file', () => {
      const content = service._loadTemplate();

      expect(content).toBeDefined();
      expect(content).toContain('TEMPLATE_DOC_ID');
      expect(content).toContain('JOURNAL_TIME_HOUR');
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('_injectPreferences', () => {
    it('should replace template placeholders with user preferences', () => {
      const template = 'const TEMPLATE_DOC_ID = \'{{TEMPLATE_DOC_ID}}\';';
      const preferences = {
        templateId: 'ABC123'
      };

      const result = service._injectPreferences(template, preferences);

      expect(result).toContain('const TEMPLATE_DOC_ID = \'ABC123\';');
      expect(result).not.toContain('{{TEMPLATE_DOC_ID}}');
    });

    it('should handle all preference fields', () => {
      const template = `
        const TEMPLATE_DOC_ID = '{{TEMPLATE_DOC_ID}}';
        const JOURNAL_TIME_HOUR = {{JOURNAL_TIME_HOUR}};
        const JOURNAL_FOLDER_NAME = '{{JOURNAL_FOLDER_NAME}}';
        const LLM_API_URL = '{{LLM_API_URL}}';
      `;

      const preferences = {
        templateId: 'T123',
        journalTimeHour: 7,
        journalTimeMinute: 30,
        journalFolderName: 'My Journals',
        llmApiUrl: 'https://test.ngrok.io'
      };

      const result = service._injectPreferences(template, preferences);

      expect(result).toContain("const TEMPLATE_DOC_ID = 'T123'");
      expect(result).toContain('const JOURNAL_TIME_HOUR = 7');
      expect(result).toContain("const JOURNAL_FOLDER_NAME = 'My Journals'");
      expect(result).toContain("const LLM_API_URL = 'https://test.ngrok.io'");
    });
  });
});

