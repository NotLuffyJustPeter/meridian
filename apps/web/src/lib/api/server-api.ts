import type {
  ApiEnvelope,
  ApiErrorResponse,
} from '../../features/auth/types/auth.types';

const DEFAULT_API_ORIGIN =
  'http://127.0.0.1:3001';

function getApiOrigin(): string {
  return (
    process.env.API_ORIGIN ??
    DEFAULT_API_ORIGIN
  ).replace(/\/$/, '');
}

export type ServerApiResult<T> = {
  response: Response;
  payload:
    | ApiEnvelope<T>
    | ApiErrorResponse;
};

export async function serverApiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<ServerApiResult<T>> {
  const headers = new Headers(init.headers);

  if (
    init.body &&
    !headers.has('content-type')
  ) {
    headers.set(
      'content-type',
      'application/json',
    );
  }

  headers.set(
    'accept',
    'application/json',
  );

  const response = await fetch(
    `${getApiOrigin()}${path}`,
    {
      ...init,
      headers,
      cache: 'no-store',
    },
  );

  const rawBody =
    await response.text();

  let payload:
    | ApiEnvelope<T>
    | ApiErrorResponse;

  if (!rawBody) {
    payload = {
      statusCode: response.status,
      message: response.ok
        ? 'Empty response'
        : 'API request failed',
    };
  } else {
    try {
      payload = JSON.parse(
        rawBody,
      ) as
        | ApiEnvelope<T>
        | ApiErrorResponse;
    } catch {
      payload = {
        statusCode: response.status,
        message:
          'Backend returned an invalid JSON response',
      };
    }
  }

  return {
    response,
    payload,
  };
}