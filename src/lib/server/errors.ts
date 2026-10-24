export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super('PostgreSQL is not configured or unavailable.');
    this.name = 'DatabaseUnavailableError';
  }
}

export function errorResponse(error: unknown): Response {
  const requestId = crypto.randomUUID();
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (error instanceof DatabaseUnavailableError) {
    return Response.json(
      {
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The persistent data service is unavailable.',
          requestId,
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Do not log or return connection strings, credentials, or driver error text.
  console.error('CASEPULSE API request failed', { requestId });
  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request could not be completed.',
        requestId,
      },
    },
    { status: 500, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function validationError(message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', message, details);
}
