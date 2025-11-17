// tests/integration/api/journal.test.js

const request = require('supertest');
const express = require('express');

// Mock dependencies before requiring routes
jest.mock('../../../src/services/googleDriveService');
jest.mock('../../../src/services/journalService');
jest.mock('../../../src/services/userOnboardingService', () => ({
  getUserSelectedTemplate: jest.fn(async () => ({
    Template: { googleDocId: 'TEMPLATE_ID' },
    journalFolderName: 'Daily Journals',
    journalTimeHour: 6,
    journalTimeMinute: 0
  }))
}));

jest.mock('../../../src/services/googleAuthService', () => ({
  verifyJWT: jest.fn(() => ({ userId: 1 })),
  getOAuth2ClientForUser: jest.fn(async () => ({}))
}));

jest.mock('../../../src/models/user', () => ({
  findByPk: jest.fn(async () => ({ id: 1, email: 'test@example.com' }))
}));

jest.mock('../../../src/database/db', () => ({
  sequelize: {
    define: jest.fn(() => ({})),
    authenticate: jest.fn(async () => {}),
    sync: jest.fn(async () => {}),
    query: jest.fn(async () => [])
  },
  testConnection: jest.fn(async () => {})
}));

const createJournalRoutes = require('../../../src/routes/journalRoutes');
const { authenticate } = require('../../../src/middleware/auth');
const { JournalService } = require('../../../src/services/journalService');
const { GoogleDriveService } = require('../../../src/services/googleDriveService');

// Create test app with mocked services
function createTestApp() {
  const app = express();
  app.use(express.json());

  const mockDriveService = {
    duplicateTemplate: jest.fn(),
    getOrCreateFolder: jest.fn(),
    findFileByName: jest.fn(),
    appendToDocument: jest.fn(),
    createCalendarEvent: jest.fn()
  };

  const mockUser = { id: 1, email: 'test@example.com' };
  const mockJournalService = {
    findJournalByDate: jest.fn(),
    createDailyJournal: jest.fn(),
    appendVoiceEntry: jest.fn()
  };

  // Mock JournalService constructor
  JournalService.mockImplementation(() => mockJournalService);
  
  app.use('/api/journal', authenticate, (req, res, next) => {
    req.journalService = mockJournalService;
    next();
  }, createJournalRoutes());
  
  return { app, mockDriveService, mockJournalService };
}

describe('Journal API', () => {
  let testApp, mockJournalService;

  beforeEach(() => {
    const testSetup = createTestApp();
    testApp = testSetup.app;
    mockJournalService = testSetup.mockJournalService;
  });

  describe('POST /api/journal/voice-entry', () => {
    beforeEach(() => {
      mockJournalService.findJournalByDate.mockResolvedValue({
        id: 'doc123',
        name: 'Journal - 2025-01-15',
        date: '2025-01-15',
        url: 'https://docs.google.com/document/d/doc123'
      });
      mockJournalService.appendVoiceEntry.mockResolvedValue({
        success: true,
        context: 'meeting'
      });
    });

    it('should accept voice entry and log to journal', async () => {
      const entry = {
        text: 'Meeting with team',
        lat: 40.7128,
        lng: -74.0060,
        context: 'meeting'
      };

      const response = await request(testApp)
        .post('/api/journal/voice-entry')
        .send(entry)
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require authentication', async () => {
      const response = await request(testApp)
        .post('/api/journal/voice-entry')
        .send({ text: 'Test entry' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(testApp)
        .post('/api/journal/voice-entry')
        .send({})
        .set('Authorization', 'Bearer valid_token')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should detect context automatically if not provided', async () => {
      mockJournalService.appendVoiceEntry.mockResolvedValue({
        success: true,
        context: 'fitness'
      });
      
      const entry = {
        text: 'Going to the gym'
      };

      const response = await request(testApp)
        .post('/api/journal/voice-entry')
        .send(entry)
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body.context).toBe('fitness');
    });
  });

  describe('GET /api/journal/:date', () => {
    it('should return journal for given date', async () => {
      const date = '2025-01-15';
      mockJournalService.findJournalByDate.mockResolvedValue({
        id: 'doc123',
        name: `Journal - ${date}`,
        date,
        url: 'https://docs.google.com/document/d/doc123'
      });

      const response = await request(testApp)
        .get(`/api/journal/${date}`)
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('date', date);
    });

    it('should return 404 if journal not found', async () => {
      const date = '2025-01-01';
      mockJournalService.findJournalByDate.mockResolvedValue(null);

      const response = await request(testApp)
        .get(`/api/journal/${date}`)
        .set('Authorization', 'Bearer valid_token')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate date format', async () => {
      const response = await request(testApp)
        .get('/api/journal/invalid-date')
        .set('Authorization', 'Bearer valid_token')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/journal/create', () => {
    beforeEach(() => {
      mockJournalService.createDailyJournal.mockResolvedValue({
        id: 'doc123',
        name: 'Journal - 2025-01-15',
        date: '2025-01-15',
        url: 'https://docs.google.com/document/d/doc123'
      });
    });

    it('should create a new journal for today', async () => {
      const response = await request(testApp)
        .post('/api/journal/create')
        .set('Authorization', 'Bearer valid_token')
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('date');
    });

    it('should create journal for specific date', async () => {
      const date = '2025-01-20';
      mockJournalService.createDailyJournal.mockResolvedValue({
        id: 'doc456',
        name: `Journal - ${date}`,
        date,
        url: 'https://docs.google.com/document/d/doc456'
      });

      const response = await request(testApp)
        .post('/api/journal/create')
        .send({ date })
        .set('Authorization', 'Bearer valid_token')
        .expect(201);

      expect(response.body.date).toBe(date);
    });
  });
});

