const request = require('supertest');

// Mock models before requiring app
jest.mock('../../models/user', () => ({
  findByPk: jest.fn(async () => ({ id: 1, email: 'user@example.com', name: 'Test User', googleId: 'g123' })),
  findOrCreate: jest.fn(async () => [{ id: 1, email: 'user@example.com', googleId: 'g123', name: 'Test User' }, true])
}));

jest.mock('../../services/googleAuthService', () => ({
  getAuthUrl: jest.fn(() => 'https://example.com/oauth'),
  getTokensFromCode: jest.fn(async () => ({ access_token: 'access', refresh_token: 'refresh' })),
  getOrCreateUser: jest.fn(async () => ({ id: 1, email: 'user@example.com', googleId: 'g123', name: 'Test User' })),
  generateJWT: jest.fn(() => 'jwt-token'),
  verifyJWT: jest.fn(() => ({ userId: 1 })),
  revokeTokens: jest.fn(async () => {})
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

describe('Auth Routes', () => {
  const originalEnv = process.env;
  beforeAll(() => {
    process.env = { ...originalEnv, FRONTEND_URL: 'http://localhost:3001' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('GET /api/auth/google redirects to OAuth provider', async () => {
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/oauth');
  });

  test('GET /api/auth/google/callback without code redirects with error', async () => {
    const res = await request(app).get('/api/auth/google/callback');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login?error=no_code');
  });

  test('GET /api/auth/google/callback with code redirects to frontend with token', async () => {
    const res = await request(app).get('/api/auth/google/callback?code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3001/auth/callback?token=jwt-token');
  });

  test('GET /api/auth/me returns current user when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer anytoken');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ id: 1, email: 'user@example.com', name: 'Test User', googleId: 'g123' })
    );
  });

  test('POST /api/auth/logout revokes tokens and returns success', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer anytoken');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
  });
});
