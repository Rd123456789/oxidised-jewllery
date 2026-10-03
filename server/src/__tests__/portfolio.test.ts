import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('Portfolio API Endpoints', () => {
  const app = createApp();

  describe('POST /api/v1/portfolio/contact', () => {
    it('rejects incomplete inquiries', async () => {
      const response = await request(app)
        .post('/api/v1/portfolio/contact')
        .send({ name: 'R' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('rejects invalid email formats', async () => {
      const response = await request(app)
        .post('/api/v1/portfolio/contact')
        .send({
          name: 'Sarah Recruiter',
          email: 'not-an-email',
          message: 'Interested in interviewing you for a senior role.',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/portfolio/cv', () => {
    it('returns PDF file or CV JSON metadata', async () => {
      const response = await request(app)
        .get('/api/v1/portfolio/cv?format=json')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.filename).toBe('Rajdip-parmar-cv.pdf');
    });
  });

  describe('Portfolio Admin Auth & Inquiries', () => {
    it('rejects invalid admin login credentials', async () => {
      const response = await request(app)
        .post('/api/v1/portfolio/admin/login')
        .send({ email: 'wrong@test.com', password: 'badpassword' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('authenticates admin with valid credentials and issues token', async () => {
      const response = await request(app)
        .post('/api/v1/portfolio/admin/login')
        .send({ email: 'rajdipparmar221@gmail.com', password: 'Rajdip053' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('rajdipparmar221@gmail.com');
    });

    it('blocks unauthorized access to inquiries list', async () => {
      const response = await request(app)
        .get('/api/v1/portfolio/admin/inquiries');

      expect(response.status).toBe(401);
    });
  });
});
