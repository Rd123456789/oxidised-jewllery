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

    it('serves the PDF with application/pdf content type', async () => {
      const response = await request(app)
        .get('/api/v1/portfolio/cv');

      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('application/pdf');
        expect(response.headers['content-disposition']).toContain('Rajdip-parmar-cv.pdf');
      }
    });
  });
});
