import { SpanStatusCode, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { app } from "electron";
import { readFile } from "node:fs/promises";
import os from "node:os";

import { computeErrorFingerprint } from "../shared/errors";
import {
  OTLP_ENDPOINT,
  OTLP_HEADERS,
} from "../shared/telemetry/setup";
import type { ReportableError } from "../shared/types/errors";

let errorReportingDisabled = false;

export function disableErrorReporting(): void {
  errorReportingDisabled = true;
}

export function isErrorReportingDisabled(): boolean {
  return errorReportingDisabled;
}

export function errorToReportableError(error: Error): ReportableError {
  return {
    message: error.message,
    stack: error.stack,
    allowReport: "allowReport" in error && !!error.allowReport,
    details: Object.keys(error)
      .map((key) => `${key}: ${error[key]}`)
      .join("\n"),
  };
}

interface ICrashInfo {
  type: string;
  error: ReportableError;
  context?: Record<string, string>;
  reportProcess?: string;
}

export async function sendReportFile(filePath: string): Promise<void> {
  const contents = await readFile(filePath, "utf8");
  const json: ICrashInfo = JSON.parse(contents) as ICrashInfo;
  await reportCrash(
    json.type,
    json.error,
    json.context,
    json.reportProcess,
  );
}

/**
 * Create a short-lived OTel provider, record a crash error span,
 * flush the export, and shut down.
 */
export async function reportCrash(
  type: string,
  error: ReportableError,
  context?: Record<string, string>,
  sourceProcess?: string,
): Promise<void> {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: "vortex",
    [ATTR_SERVICE_VERSION]: app.getVersion(),
    "deployment.environment": "test",
    "process.type": "report",
    "os.type": os.type(),
    "os.version": os.release(),
    "host.arch": os.arch(),
  });

  const exporter = new OTLPTraceExporter({
    url: OTLP_ENDPOINT,
    headers: OTLP_HEADERS,
  });

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register();

  try {
    const tracer = trace.getTracer("vortex.crash");
    const span = tracer.startSpan("crash.report", {
      attributes: {
        "crash.type": type,
        "crash.sourceProcess": sourceProcess ?? "unknown",
        "error.title": error.title ?? "",
        "error.message": error.message,
        "error.code": error.code ?? "",
      },
    });

    // Attach ambient context (game mode, etc.) from the crashed process
    if (context !== undefined) {
      for (const [key, value] of Object.entries(context)) {
        span.setAttribute(`context.${key}`, value);
      }
    }

    const fingerprint = computeErrorFingerprint(
      error.stack,
      app.getVersion(),
    );
    if (fingerprint !== undefined) {
      span.setAttribute("error.fingerprint", fingerprint);
    }

    const errorObj = new Error(error.message);
    errorObj.stack = error.stack;
    span.recordException(errorObj);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.end();
  } finally {
    await provider.forceFlush();
    await provider.shutdown();
  }
}

