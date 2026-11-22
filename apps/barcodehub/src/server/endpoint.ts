import type { z } from 'zod';

export type ErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR';

/** An error whose userFacingMessage is safe to show; the API server maps code to an HTTP status. */
export class ApiError extends Error {
  code: ErrorCode;
  userFacingMessage?: string;
  constructor({ code, message, userFacingMessage }: { code: ErrorCode; message: string; userFacingMessage?: string }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.userFacingMessage = userFacingMessage;
  }
}

/** The signed-in user an endpoint sees (built by the API server from a verified session). */
export type EndpointUser = {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  isAdmin?: boolean;
};

export type RequestContext = {
  /** Always set for `authenticated: true` endpoints; null otherwise when signed out. */
  user: EndpointUser;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

export type Endpoint<S extends z.ZodTypeAny, O> = {
  description?: string;
  /** The API server rejects requests without a valid session before execute runs. */
  authenticated?: boolean;
  /** The API server parses every request with this schema before execute runs. */
  inputSchema: S;
  /** Documentation only. */
  outputSchema?: z.ZodTypeAny;
  execute: (params: { input: z.infer<S>; context: RequestContext }) => Promise<O> | O;
};

/** Declares an API endpoint served at /api/<file name>. Identity function: it only gives the config its types. */
export function createEndpoint<S extends z.ZodTypeAny, O>(config: Endpoint<S, O>): Endpoint<S, O> {
  return config;
}
