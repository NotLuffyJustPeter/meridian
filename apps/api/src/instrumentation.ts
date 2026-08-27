import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const telemetryEnabled = process.env.OTEL_ENABLED === 'true';

if (telemetryEnabled) {
  const traceExporter = new OTLPTraceExporter();

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'meridian-api',

    traceExporter,

    instrumentations: [
      new HttpInstrumentation(),

      new ExpressInstrumentation(),

      new NestInstrumentation(),

      new PrismaInstrumentation(),

      new PgInstrumentation({
        enhancedDatabaseReporting: false,

        requireParentSpan: true,

        ignoreConnectSpans: true,
      }),

      new PinoInstrumentation({
        disableLogSending: true,
      }),
    ],
  });

  sdk.start();

  process.once('beforeExit', () => {
    void sdk.shutdown();
  });
}
