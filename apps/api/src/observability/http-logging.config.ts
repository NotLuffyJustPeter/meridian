import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Options } from 'pino-http';

const REQUEST_ID_HEADER = 'x-request-id';

const MAX_REQUEST_ID_LENGTH = 128;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

type RequestWithId = IncomingMessage & {
  id?: string | number;
};

function incomingRequestId(request: IncomingMessage): string | null {
  const rawValue = request.headers[REQUEST_ID_HEADER];

  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_REQUEST_ID_LENGTH ||
    !REQUEST_ID_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function serializeRequest(request: RequestWithId) {
  return {
    id: request.id,

    method: request.method,

    url: request.url,
  };
}

function serializeResponse(response: ServerResponse) {
  return {
    statusCode: response.statusCode,
  };
}

export function createPinoHttpOptions(): Options {
  return {
    name: 'meridian-api',

    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

    wrapSerializers: false,

    genReqId(request, response) {
      const requestId = incomingRequestId(request) ?? randomUUID();

      response.setHeader(REQUEST_ID_HEADER, requestId);

      return requestId;
    },

    serializers: {
      req: serializeRequest,

      res: serializeResponse,
    },

    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',

        'req.body.password',
        'req.body.accessToken',
        'req.body.refreshToken',
        'req.body.idToken',
        'req.body.mfaCode',
        'req.body.totpCode',
        'req.body.recoveryCode',

        'password',
        'accessToken',
        'refreshToken',
        'idToken',
        'mfaSecret',
        'totpSecret',

        '*.password',
        '*.accessToken',
        '*.refreshToken',
        '*.idToken',
        '*.mfaSecret',
        '*.totpSecret',
      ],

      censor: '[REDACTED]',
    },

    customProps(request) {
      const requestWithId = request as RequestWithId;

      return {
        service: 'meridian-api',

        ...(requestWithId.id !== undefined
          ? {
              requestId: String(requestWithId.id),
            }
          : {}),
      };
    },

    customLogLevel(_request, response, error) {
      if (error || response.statusCode >= 500) {
        return 'error';
      }

      if (response.statusCode >= 400) {
        return 'warn';
      }

      return 'info';
    },

    customSuccessMessage() {
      return 'request completed';
    },

    customErrorMessage() {
      return 'request failed';
    },
  };
}
