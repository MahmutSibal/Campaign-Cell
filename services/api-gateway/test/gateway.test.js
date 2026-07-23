const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

describe('API Gateway Middleware & Routing Tests', () => {
  const secret = process.env.JWT_SECRET || 'campaigncell-secret-key-change-in-prod';

  it('should return aggregated health check status from GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
    expect(res.headers).toHaveProperty('x-correlation-id');
  });

  it('should generate x-correlation-id if not provided', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-correlation-id'].length).toBeGreaterThan(10);
  });

  it('should preserve provided x-correlation-id', async () => {
    const customCorrelationId = 'custom-test-correlation-uuid-12345';
    const res = await request(app)
      .get('/health')
      .set('x-correlation-id', customCorrelationId);

    expect(res.headers['x-correlation-id']).toBe(customCorrelationId);
  });

  it('should block protected routes with 401 Unauthorized when JWT token is missing', async () => {
    const res = await request(app).get('/api/v1/campaigns');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should block protected routes with 401 Unauthorized when JWT token is invalid', async () => {
    const res = await request(app)
      .get('/api/v1/campaigns')
      .set('Authorization', 'Bearer invalid.jwt.token');

    expect(res.statusCode).toBe(401);
  });

  it('should allow public auth routes without JWT token', async () => {
    // /api/v1/auth/login public path'tir, auth middleware 401 atmamalı (proxy target down olsa bile 503 verir)
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.statusCode).not.toBe(401);
  });
});
