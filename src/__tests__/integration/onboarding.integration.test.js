const request = require('supertest');
const app = require('../../app');

jest.mock('../../services/userOnboardingService', () => ({
  getOnboardingStatus: jest.fn(async (userId) => ({
    isComplete: false,
    selectedTemplate: null
  })),
  selectTemplate: jest.fn(async (userId, templateId) => ({ userId, templateId })),
  confirmTemplateSelection: jest.fn(async (userId, templateId, preferences) => ({
    templateId,
    journalFolderName: preferences.journalFolderName,
    journalTimeHour: preferences.journalTimeHour,
    journalTimeMinute: preferences.journalTimeMinute
  }))
}));

jest.mock('../../services/googleAuthService', () => ({ verifyJWT: jest.fn(() => ({ userId: 1 })) }));
jest.mock('../../models/user', () => ({ findByPk: jest.fn(async () => ({ id: 1 })) }));

describe('Onboarding Routes', () => {
  test('GET /api/onboarding/status returns status for authenticated user', async () => {
    const res = await request(app)
      .get('/api/onboarding/status')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('isComplete', false);
  });

  test('POST /api/onboarding/select-template with missing templateId returns 400', async () => {
    const res = await request(app)
      .post('/api/onboarding/select-template')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/onboarding/select-template selects template', async () => {
    const res = await request(app)
      .post('/api/onboarding/select-template')
      .set('Authorization', 'Bearer token')
      .send({ templateId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.objectContaining({ templateId: 1 }));
  });

  test('POST /api/onboarding/confirm saves preferences', async () => {
    const res = await request(app)
      .post('/api/onboarding/confirm')
      .set('Authorization', 'Bearer token')
      .send({
        templateId: 1,
        preferences: { journalFolderName: 'Daily Journals', journalTimeHour: 6, journalTimeMinute: 0 }
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.objectContaining({
      templateId: 1,
      journalFolderName: 'Daily Journals',
      journalTimeHour: 6,
      journalTimeMinute: 0
    }));
  });
});
