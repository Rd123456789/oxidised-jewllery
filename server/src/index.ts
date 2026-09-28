import type { Server } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

let server: Server | undefined;

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();

  server = app.listen(env.PORT, () => {
    logger.info(`API ready on http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(
      `Image uploads: ${env.cloudinaryEnabled ? 'Cloudinary' : 'local disk (server/uploads)'}`,
    );
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.warn(`Received ${signal}, shutting down gracefully`);

  try {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  void shutdown('uncaughtException');
});

bootstrap().catch((error) => {
  logger.error('Failed to start the API', error);
  process.exit(1);
});
