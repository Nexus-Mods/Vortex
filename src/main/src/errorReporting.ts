import type { ReportableError } from "@vortex/shared/errors";

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { sanitizeFramePath } from "@vortex/shared";
import { recordErrorOnSpan } from "@vortex/shared/telemetry";
import { app } from "electron";
import { readFile } from "node:fs/promises";

import { createVortexResource } from "./telemetry/resources";
import { COLLECTOR_URL, OTLP_HEADERS } from "./telemetry/setup";

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
  await reportCrash(json.type, json.error, json.context, json.reportProcess);
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
  const resource = createVortexResource("report");

  const exporter = new OTLPTraceExporter({
    url: `${COLLECTOR_URL}/v1/traces`,
    headers: OTLP_HEADERS,
  });

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  // Don't call provider.register() — if a global provider is already
  // registered, OTel silently ignores subsequent registrations. Use
  // provider.getTracer() directly so spans go through this provider's
  // exporter and forceFlush() actually sends them.

  try {
    const tracer = provider.getTracer("vortex.crash");
    const span = tracer.startSpan("crash.report", {
      attributes: {
        "crash.type": type,
        "crash.sourceProcess": sourceProcess ?? "unknown",
        "error.message": sanitizeFramePath(error.message),
        "error.code": error.code ?? "",
      },
    });

    const errorObj = new Error(error.message);
    errorObj.stack = error.stack;
    recordErrorOnSpan(span, errorObj, app.getVersion(), context, {
      "error.title": error.title ?? "",
    });
    span.end();
  } finally {
    await provider.forceFlush();
    await provider.shutdown();
  }
}
