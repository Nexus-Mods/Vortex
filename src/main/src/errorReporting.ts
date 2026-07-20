import { readFile, rename, unlink } from "node:fs/promises";
import * as path from "node:path";

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { getErrorCode, getErrorMessageOrDefault, sanitizeFramePath } from "@vortex/shared";
import type { ReportableError } from "@vortex/shared/errors";
import { recordErrorOnSpan, SanitizingSpanExporter } from "@vortex/shared/telemetry";
import { app } from "electron";

import { log } from "./logging";
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
    details: Object.entries(error)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
  };
}

interface ICrashInfo {
  type: string;
  error: ReportableError;
  context?: Record<string, string>;
  reportProcess?: string;
  consentGiven?: boolean;
}

export async function sendReportFile(filePath: string): Promise<void> {
  let json: ICrashInfo;
  try {
    const contents = await readFile(filePath, "utf8");
    json = JSON.parse(contents) as ICrashInfo;
  } catch (err) {
    // an unreadable report can never be sent — remove it so it isn't retried
    if (getErrorCode(err) !== "ENOENT") {
      await unlink(filePath).catch(() => {
        /* ignored */
      });
    }
    throw err;
  }
  await reportCrash(json.type, json.error, json.context, json.reportProcess, json.consentGiven);
  await unlink(filePath).catch(() => {
    /* ignored */
  });
}

/**
 * Send a crashinfo.json left behind by a previous session, then remove it.
 * Runs before the single-instance lock, so the file is claimed by an atomic
 * rename first.
 */
export async function sendPendingCrashReport(): Promise<void> {
  const reportPath = path.join(app.getPath("userData"), "crashinfo.json");
  const claimedPath = reportPath + ".sending";
  try {
    await rename(reportPath, claimedPath);
  } catch (err) {
    if (getErrorCode(err) !== "ENOENT") {
      log("warn", "failed to claim pending crash report", {
        error: getErrorMessageOrDefault(err),
      });
    }
    return;
  }
  try {
    await sendReportFile(claimedPath);
    log("info", "sent pending crash report from previous session");
  } catch (err) {
    log("warn", "failed to send pending crash report", {
      error: getErrorMessageOrDefault(err),
    });
    // retry on next startup; unreadable reports were already deleted
    await rename(claimedPath, reportPath).catch(() => {
      /* ignored */
    });
  }
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
  consentGiven = false,
): Promise<void> {
  const resource = createVortexResource("report");

  const exporter = new SanitizingSpanExporter(
    new OTLPTraceExporter({
      url: `${COLLECTOR_URL}/v1/traces`,
      headers: OTLP_HEADERS,
    }),
    () => consentGiven,
  );

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
