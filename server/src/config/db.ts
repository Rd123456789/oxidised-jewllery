import mongoose, { type ConnectOptions } from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 3000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let listenersRegistered = false;

function registerConnectionListeners(): void {
  if (listenersRegistered) {
    return;
  }

  listenersRegistered = true;

  const connection = mongoose.connection;

  connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  connection.on('error', (error: unknown) => logger.error('MongoDB error', error));
}

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  mongoose.set('strictQuery', true);
  // NOTE: do NOT enable `sanitizeFilter` here. It rewrites every operator object into
  // `{ $eq: ... }` (see mongoose/lib/helpers/query/sanitizeFilter.js) and throws on
  // `$text` / `$expr` / `$where`, which silently breaks search, price ranges, stock and
  // status filters. Injection is prevented upstream instead: Zod whitelists query keys and
  // coerces values, and user-supplied strings are escaped before becoming RegExp.
  mongoose.set('runValidators', true);

  registerConnectionListeners();

  const options: ConnectOptions = {
    serverSelectionTimeoutMS: 15_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 20,
    minPoolSize: 0,
    autoIndex: !env.isProduction,
    ...(env.MONGODB_DB_NAME ? { dbName: env.MONGODB_DB_NAME } : {}),
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(env.MONGODB_URI, options);

      const { host, name } = mongoose.connection;
      logger.info(`MongoDB connected -> ${host ?? 'unknown'}/${name ?? 'unknown'}`);

      return mongoose;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${message}`);

      if (attempt === MAX_RETRIES) {
        throw error;
      }

      await delay(BASE_RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error('Unable to connect to MongoDB');
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close(false);
  logger.info('MongoDB connection closed');
}

export function databaseStatus(): { readyState: number; state: string; name?: string; host?: string } {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const { readyState, name, host } = mongoose.connection;

  return { readyState, state: states[readyState] ?? 'unknown', name, host };
}
