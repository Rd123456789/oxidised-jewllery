import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const app = createApp();

describe('API shell', () => {
  it('exposes a health endpoint', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });

  it('returns a structured 404 for unknown routes', async () => {
    const response = await request(app).get('/api/v1/not-a-real-route');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed registration payloads with field level details', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: '123' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);

    const fields = (response.body.error.details as { field: string }[]).map((detail) => detail.field);

    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });

  it('rejects unknown query parameters on the product listing', async () => {
    const response = await request(app).get('/api/v1/products?limit=999');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  /**
   * Deliberately asserted at the API prefix rather than `/`: when the storefront bundle is
   * present (the single-origin deploy) `/` belongs to the app shell, so the index needs a
   * stable path that does not depend on whether `web/dist` has been built.
   */
  it('serves the API index', async () => {
    const response = await request(app).get('/api/v1');

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Oxidised Jewellery API');
  });
});
