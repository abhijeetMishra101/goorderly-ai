// tests/unit/services/journalService.test.js

const { JournalService } = require('../../../src/services/journalService');

jest.mock('../../../src/services/userOnboardingService');
jest.mock('../../../src/services/googleDriveService', () => ({
  GoogleDriveService: jest.fn().mockImplementation(() => ({
    duplicateTemplate: jest.fn(),
    getOrCreateFolder: jest.fn(),
    createCalendarEvent: jest.fn(),
    findFileByName: jest.fn(),
    appendToDocument: jest.fn(),
    getDocumentText: jest.fn()
  }))
}));

describe('JournalService', () => {
  let journalService;
  let mockUser;
  let mockDriveService;
  let userOnboardingService;

  beforeEach(() => {
    mockUser = {
      id: 1,
      email: 'test@example.com',
      googleId: 'g123'
    };

    mockDriveService = {
      duplicateTemplate: jest.fn(),
      getOrCreateFolder: jest.fn(),
      createCalendarEvent: jest.fn(),
      findFileByName: jest.fn(),
      appendToDocument: jest.fn(),
      getDocumentText: jest.fn()
    };

    userOnboardingService = require('../../../src/services/userOnboardingService');
    userOnboardingService.getUserSelectedTemplate = jest.fn().mockResolvedValue({
      Template: {
        googleDocId: 'TEMPLATE_ID_123'
      },
      journalFolderName: 'Daily Journals',
      journalTimeHour: 6,
      journalTimeMinute: 0
    });

    // Get the mocked GoogleDriveService and set up methods
    const { GoogleDriveService } = require('../../../src/services/googleDriveService');
    mockDriveService = new GoogleDriveService(mockUser);
    
    journalService = new JournalService(mockUser);
  });

  describe('createDailyJournal', () => {
    it('should create a new journal document', async () => {
      const date = '2025-01-15';
      const mockDoc = {
        id: 'doc123',
        name: `Journal - ${date}`,
        webViewLink: 'https://docs.google.com/document/d/doc123'
      };

      mockDriveService.getOrCreateFolder.mockResolvedValue({ id: 'folder123' });
      mockDriveService.duplicateTemplate.mockResolvedValue(mockDoc);

      const result = await journalService.createDailyJournal(date);

      expect(result).toHaveProperty('id', 'doc123');
      expect(result).toHaveProperty('name', `Journal - ${date}`);
      expect(mockDriveService.duplicateTemplate).toHaveBeenCalledWith(
        date,
        'folder123',
        'TEMPLATE_ID_123'
      );
    });

    it('should handle errors when creating journal', async () => {
      mockDriveService.getOrCreateFolder.mockRejectedValue(
        new Error('Drive API error')
      );

      await expect(
        journalService.createDailyJournal('2025-01-15')
      ).rejects.toThrow('Drive API error');
    });

    it('should create calendar event after journal creation', async () => {
      const date = '2025-01-15';
      const mockDoc = {
        id: 'doc123',
        name: `Journal - ${date}`,
        webViewLink: 'https://docs.google.com/document/d/doc123'
      };

      mockDriveService.getOrCreateFolder.mockResolvedValue({ id: 'folder123' });
      mockDriveService.duplicateTemplate.mockResolvedValue(mockDoc);

      await journalService.createDailyJournal(date, { createCalendarEvent: true });

      expect(mockDriveService.createCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining(date),
          startTime: expect.any(Date)
        })
      );
    });
  });

  describe('findJournalByDate', () => {
    it('should find journal by date', async () => {
      const date = '2025-01-15';
      const mockDoc = {
        id: 'doc123',
        name: `Journal - ${date}`
      };

      mockDriveService.findFileByName.mockResolvedValue(mockDoc);

      const result = await journalService.findJournalByDate(date);

      expect(result).toEqual(mockDoc);
      expect(mockDriveService.findFileByName).toHaveBeenCalledWith(
        `Journal - ${date}`
      );
    });

    it('should return null if journal not found', async () => {
      mockDriveService.findFileByName.mockResolvedValue(null);

      const result = await journalService.findJournalByDate('2025-01-15');

      expect(result).toBeNull();
    });
  });

  describe('appendVoiceEntry', () => {
    it('should append voice entry to journal', async () => {
      const docId = 'doc123';
      const entry = {
        text: 'Meeting with team',
        timestamp: new Date('2025-01-15T10:30:00'),
        lat: 40.7128,
        lng: -74.0060,
        context: 'meeting'
      };

      mockDriveService.appendToDocument.mockResolvedValue({ success: true });

      const result = await journalService.appendVoiceEntry(docId, entry);

      expect(result.success).toBe(true);
      expect(mockDriveService.appendToDocument).toHaveBeenCalledWith(
        docId,
        expect.stringContaining('Meeting with team')
      );
    });

    it('should include geo-tagging when provided', async () => {
      const docId = 'doc123';
      const entry = {
        text: 'At the office',
        lat: 40.7128,
        lng: -74.0060
      };

      await journalService.appendVoiceEntry(docId, entry);

      expect(mockDriveService.appendToDocument).toHaveBeenCalledWith(
        docId,
        expect.stringContaining('📍')
      );
    });

    it('should include context tag when detected', async () => {
      const docId = 'doc123';
      const entry = {
        text: 'Meeting with team',
        context: 'meeting'
      };

      await journalService.appendVoiceEntry(docId, entry);

      expect(mockDriveService.appendToDocument).toHaveBeenCalledWith(
        docId,
        expect.stringContaining('#meeting')
      );
    });
  });
});

