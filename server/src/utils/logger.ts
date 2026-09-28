export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const colors: Record<LogLevel, string> = {
  debug: '\u001b[90m',
  info: '\u001b[36m',
  warn: '\u001b[33m',
  error: '\u001b[31m',
};

const reset = '\u001b[0m';

const levelOrder: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel: LogLevel = process.env['NODE_ENV'] === 'production' ? 'info' : 'debug';

function write(level: LogLevel, message: string, meta?: unknown): void {
  if (levelOrder[level] < levelOrder[minLevel]) {
    return;
  }

  const timestamp = new Date().toISOString();
  const prefix = `${colors[level]}${level.toUpperCase().padEnd(5)}${reset} ${timestamp}`;
  const line = `${prefix} ${message}`;

  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (meta === undefined) {
    sink(line);
    return;
  }

  sink(line, meta);
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
