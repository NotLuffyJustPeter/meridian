# Meridian V2 Observability Report

## Scope

This report records the implementation and runtime verification of
Meridian V2 observability.

The observability stack is local-first and does not require a paid
external monitoring provider.

## Components

- Pino structured JSON logging
- Request and correlation IDs
- OpenTelemetry NodeSDK
- HTTP instrumentation
- Express instrumentation
- NestJS instrumentation
- Prisma instrumentation
- PostgreSQL instrumentation
- Pino trace-context correlation
- Jaeger local tracing
- OTLP/HTTP trace export

## Structured logging

Meridian API uses Pino structured JSON logging.

Runtime request logs include:

- service
- requestId
- HTTP method
- URL
- response status
- response time

A synthetic secret-canary test confirmed that tested Authorization and
password values were not persisted in API logs.

## Request correlation

Meridian accepts a valid incoming `x-request-id`.

When no valid request ID is supplied, the API generates one.

The request ID is:

- returned in the HTTP response
- included in Pino request logs
- available for request-level correlation

Runtime propagation was verified successfully.

## OpenTelemetry

OpenTelemetry is enabled through:

`OTEL_ENABLED=true`

Local Docker Compose enables tracing for:

`meridian-api`

Trace transport:

`OTLP/HTTP`

Trace backend:

`Jaeger`

Local Jaeger UI:

`http://localhost:16686`

## End-to-end tracing

A runtime request to:

`GET /api/v1/trips`

was traced across the full application stack.

The verified trace contained:

`17 spans`

Observed layers included:

- HTTP server request
- Express middleware
- NestJS controller
- application service
- Prisma client
- PostgreSQL query execution

Representative operations included:

- `GET /api/v1/trips`
- `TripsController.findAll`
- `findAll`
- `prisma:client:operation`
- `prisma:client:db_query`
- `pg.query:SELECT meridian`

## W3C trace propagation

Client-supplied W3C Trace Context propagation was verified.

Expected trace ID:

`c5321c5dfc254114bd3253ab9fd94127`

Pino trace ID:

`c5321c5dfc254114bd3253ab9fd94127`

Result:

`TraceMatches = True`

The same trace ID was successfully retrieved from Jaeger.

## Log / trace correlation

The runtime request demonstrated correlation between:

- `x-request-id`
- Pino `requestId`
- Pino `trace_id`
- Pino `span_id`
- Jaeger trace ID

This allows a request to be followed from its HTTP log through NestJS,
Prisma, and PostgreSQL execution.

## Security

PostgreSQL enhanced database reporting is disabled.

Trace payload validation checked for accidental persistence of:

- benchmark access token
- benchmark password

No tested sensitive material was found.

Pino secret-canary validation also completed without detected leaks.

## Quality gates

Static and unit verification:

- format check: passed
- TypeScript typecheck: passed
- ESLint: passed
- API build: passed
- Docker Compose validation: passed
- git diff check: passed
- unit test suites: 24 passed / 24 total
- unit tests: 161 passed / 161 total

End-to-end verification:

- E2E suites: 12 passed / 12 total
- E2E tests: 82 passed / 82 total
- E2E failed tests: 0

## Runtime infrastructure

Local observability services:

- Meridian API
- PostgreSQL
- Jaeger
- Mailpit
- Meridian Web

Jaeger receives OTLP traces from Meridian API.

## Production behavior

Telemetry initialization is opt-in.

If:

`OTEL_ENABLED=true`

the OpenTelemetry SDK is initialized.

If the environment does not explicitly enable telemetry, the
instrumentation remains disabled.

This keeps local observability available without requiring a tracing
backend in production.

## Status

Meridian V2 Observability is verified.

Structured logging, request correlation, distributed tracing,
database tracing, log/trace correlation, Jaeger export, W3C propagation,
security validation, unit tests, and E2E tests all passed their
verification gates.