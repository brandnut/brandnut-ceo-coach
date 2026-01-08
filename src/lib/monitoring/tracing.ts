/**
 * OpenTelemetry Tracing Initialization
 *
 * Monitors backend API routes, database queries, and HTTP requests.
 * Reports to Alibaba Cloud ARMS via OTLP.
 */

import { Resource } from '@opentelemetry/resources'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import {
  SemanticResourceAttributes,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions'
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base'
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'

// Only initialize in production
if (process.env.NODE_ENV === 'production') {
  // Enable debug logging for OpenTelemetry (optional)
  // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: 'brandnut-ceo-coach',
      [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: 'production',
    }),
  })

  // Register HTTP instrumentation (monitors API routes)
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [new HttpInstrumentation()],
  })

  // Export to Alibaba Cloud ARMS via OTLP
  const exporter = new OTLPTraceExporter({
    url: 'http://tracing-analysis-dc-sh.aliyuncs.com/adapt_b63frsmgqu@fa77c7fdc890452_b63frsmgqu@53df7ad2afe8301/api/otlp/traces',
    headers: {},
  })

  // Use batch processor for better performance
  provider.addSpanProcessor(new BatchSpanProcessor(exporter))

  // Optional: Console exporter for debugging
  // provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))

  provider.register()

  console.log('[OpenTelemetry] Tracing initialized for production')
} else {
  console.log('[OpenTelemetry] Skipped in development mode')
}
