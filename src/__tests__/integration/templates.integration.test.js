const request = require('supertest');

// Mock models before requiring app
jest.mock('../../models/user', () => ({
  findByPk: jest.fn(async () => ({ id: 1 }))
}));

jest.mock('../../services/googleAuthService', () => ({
  verifyJWT: jest.fn(() => ({ userId: 1 })),
  getAuthUrl: jest.fn(() => ''),
  getTokensFromCode: jest.fn(async () => ({})),
  getOrCreateUser: jest.fn(async () => ({})),
  generateJWT: jest.fn(() => ''),
  revokeTokens: jest.fn(async () => {})
}));

jest.mock('../../services/templateService', () => ({
  getAllActiveTemplates: jest.fn(async () => ([
    { id: 1, name: 'Daily Journal Template', isActive: true },
    { id: 2, name: 'Weekly Review', isActive: true }
  ])),
  getTemplateById: jest.fn(async (id) => {
    if (id === 999) throw new Error('Template not found');
    return { id, name: 'Daily Journal Template', isActive: true };
  }),
  createTemplate: jest.fn(async (tpl) => ({ id: 3, ...tpl, isActive: true }))
}));

// Mock database connection
jest.mock('../../database/db', () => ({
  sequelize: {
    define: jest.fn(() => ({})),
    authenticate: jest.fn(async () => {}),
    sync: jest.fn(async () => {}),
    query: jest.fn(async () => [])
  },
  testConnection: jest.fn(async () => {})
}));

const app = require('../../app');

describe('Template Routes', () => {
  test('GET /api/templates returns active templates', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0]).toHaveProperty('name');
  });

  test('GET /api/templates/:id returns template', async () => {
    const res = await request(app).get('/api/templates/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', 1);
  });

  test('GET /api/templates/:id with invalid id returns 400', async () => {
    const res = await request(app).get('/api/templates/not-a-number');
    expect(res.status).toBe(400);
  });

  test('GET /api/templates/:id not found returns 404', async () => {
    const res = await request(app).get('/api/templates/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Template not found');
  });

  test('POST /api/templates creates template (auth required)', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', 'Bearer token')
      .send({ name: 'New Template', googleDocId: 'DOC123', description: 'desc' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('name', 'New Template');
  });
});
