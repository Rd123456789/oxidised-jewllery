import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors, { type CorsOptions, type CorsOptionsDelegate } from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import apiRoutes from './routes/index.js';
import seoRoutes from './routes/seo.routes.js';
import { LOCAL_UPLOAD_DIR } from './middleware/upload.js';
import { logger } from './utils/logger.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Storefront build output. Serving it from the API keeps the deploy single-origin, which
 * is what lets the refresh cookie stay `sameSite=lax` and `/sitemap.xml` resolve for
 * crawlers. Both `server/src` (tsx) and `server/dist` (compiled) sit two levels below the
 * repository root, so the relative hop is the same either way.
 */
const WEB_DIST_DIR = env.WEB_DIST_DIR
  ? path.resolve(env.WEB_DIST_DIR)
  : path.resolve(here, '..', '..', 'web', 'dist', 'web', 'browser');

const webBuildPresent = fs.existsSync(path.join(WEB_DIST_DIR, 'index.html'));

/** Angular's production build hashes every emitted file, so those are safe to cache hard. */
const HASHED_ASSET = /-[A-Za-z0-9]{8,}\.[a-z0-9]+$/;

const CLOUDINARY_ORIGIN = 'https://res.cloudinary.com';

function corsOptions(): CorsOptions {
  return {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cart-session', 'Idempotency-Key'],
    exposedHeaders: ['x-cart-session', 'Idempotent-Replay'],
    maxAge: 86_400,
  };
}

/**
 * Requests made by the storefront that this same service serves still carry an `Origin`
 * header, and `CORS_ORIGINS` cannot know a hostname that only exists after the first
 * deploy — so the service's own origin is always trusted. `CORS_ORIGINS` remains the list
 * for anything else, such as a custom domain or the Angular dev server.
 */
function corsDelegate(): CorsOptionsDelegate {
  return (req, callback) => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    const selfOrigin = typeof host === 'string' ? [`https://${host}`, `http://${host}`] : [];

    const allowed =
      !origin ||
      selfOrigin.includes(origin) ||
      env.corsOrigins.includes(origin) ||
      env.corsOrigins.includes('*');

    if (origin && !allowed) {
      logger.warn(`Blocked cross-origin request from ${origin}`);
    }

    callback(null, { ...corsOptions(), origin: allowed ? true : false });
  };
}

/**
 * Helmet's defaults are close, but not close enough to ship: `img-src 'self' data:` blocks
 * every Cloudinary delivery URL, which makes uploads succeed and then never display.
 */
function contentSecurityPolicy() {
  if (!env.isProduction) {
    return false;
  }

  return {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      // Angular emits component styles as <style> elements.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', CLOUDINARY_ORIGIN],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  };
}

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: contentSecurityPolicy(),
    }),
  );

  app.use(cors(corsDelegate()));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  if (!env.isTest) {
    app.use(
      morgan(env.isProduction ? 'combined' : 'dev', {
        stream: {
          write: (message: string) => logger.debug(message.trim()),
        },
      }),
    );
  }

  app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { maxAge: '7d', fallthrough: true }));

  app.use(seoRoutes);

  app.use(env.API_PREFIX, generalLimiter, apiRoutes);

  const apiIndex = (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        name: 'Oxidised Jewellery API',
        version: '1.0.0',
        docs: `${env.API_PREFIX}/health`,
        storefront: webBuildPresent ? 'Served by this service.' : 'Not bundled with this build.',
      },
    });
  };

  app.get(env.API_PREFIX, apiIndex);

  if (webBuildPresent) {
    app.use(
      express.static(WEB_DIST_DIR, {
        index: false,
        setHeaders: (res, filePath) => {
          res.setHeader(
            'Cache-Control',
            HASHED_ASSET.test(path.basename(filePath))
              ? 'public, max-age=31536000, immutable'
              : 'no-cache',
          );
        },
      }),
    );

    // Client-side deep links (`/product/foo`, `/admin/orders`) render the shell; the API
    // and its assets keep their own 404s.
    app.get(/^\/(?!api\/|uploads\/|sitemap\.xml$).*/, (req, res, next) => {
      if (!req.accepts('html')) {
        next();
        return;
      }

      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(WEB_DIST_DIR, 'index.html'), (error) => {
        if (error) {
          next(error);
        }
      });
    });
  } else {
    // No storefront bundle to serve, so the root stays the API index.
    app.get('/', apiIndex);
  }

  app.use(notFoundHandler);
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    errorHandler(error, req, res, next);
  });

  return app;
}

export const staticAssetPath = path.resolve(process.cwd(), 'uploads');
export { WEB_DIST_DIR, webBuildPresent };
