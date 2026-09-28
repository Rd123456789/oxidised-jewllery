export interface ApiFieldError {
  field: string;
  message: string;
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Field level messages produced by Zod validation on the API. */
  get fieldErrors(): ApiFieldError[] {
    if (!Array.isArray(this.details)) {
      return [];
    }

    return this.details
      .filter(
        (entry): entry is { field: string; message: string; code?: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          'field' in entry &&
          'message' in entry,
      )
      .map((entry) => ({ field: entry.field, message: entry.message, code: entry.code }));
  }

  fieldError(field: string): string | undefined {
    return this.fieldErrors.find((entry) => entry.field === field)?.message;
  }
}
