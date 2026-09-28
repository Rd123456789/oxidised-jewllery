process.env['NODE_ENV'] = 'test';
process.env['MONGODB_URI'] =
  process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:27017/oxidised_jewellery_test';
process.env['MONGODB_DB_NAME'] = 'oxidised_jewellery_test';
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-that-is-at-least-32-characters';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-that-is-at-least-32-characters';
process.env['COOKIE_SECRET'] = 'test-cookie-secret';
process.env['CORS_ORIGINS'] = 'http://localhost:4200';
process.env['BCRYPT_ROUNDS'] = '4';
process.env['CLOUDINARY_CLOUD_NAME'] = '';
process.env['CLOUDINARY_API_KEY'] = '';
process.env['CLOUDINARY_API_SECRET'] = '';
