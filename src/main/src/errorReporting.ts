import { type Dirent } from "node:fs";
import { readdir, readFile, rename, stat, unlink } from "node:fs/promises";
import * as path from "node:path";

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { getErrorCode, getErrorMessageOrDefault, sanitizeFramePath } from "@vortex/shared";
import type { ReportableError } from "@vortex/shared/errors";
import { recordErrorOnSpan, SanitizingSpanExporter } from "@vortex/shared/telemetry";
import { app } from "electron";

import { log } from "./logging";
import { type IMinidumpSummary, summarizeMinidumpFile } from "./minidump";
import { createVortexResource } from "./telemetry/resources";
import { COLLECTOR_URL, OTLP_HEADERS } from "./telemetry/setup";
import { isTelemetryEnabled } from "./telemetry/state";

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
 * Report native crash dumps left behind by previous sessions, then delete
 * them — a dump's existence marks an unreported crash, same protocol as
 * crashinfo.json. Renderer/gpu dumps were already reported live by the
 * *-process-gone handlers, so they are deleted unreported; main-process
 * ("browser") dumps — and dumps too corrupt to attribute — get one
 * crash.report span for the newest one. Dumps are only deleted once the
 * report is sent, so a failed send retries on the next startup.
 */
export async function reportPendingNativeCrashes(): Promise<void> {
  const dumps = (await collectCrashDumps()).sort((lhs, rhs) => rhs.mtimeMs - lhs.mtimeMs);

  const unreported: Array<{ path: string; summary: IMinidumpSummary | undefined }> = [];
  for (const dump of dumps) {
    // anything beyond the newest few is stale backlog, not worth a report
    if (unreported.length >= MAX_PROCESSED_DUMPS) {
      await unlink(dump.path).catch(() => {
        /* ignored */
      });
      continue;
    }
    const summary = await summarizeMinidumpFile(dump.path);
    if (summary?.processType !== undefined && summary.processType !== "browser") {
      await unlink(dump.path).catch(() => {
        /* ignored */
      });
    } else {
      unreported.push({ path: dump.path, summary });
    }
  }

  if (unreported.length === 0) {
    return;
  }

  const primary = unreported[0]?.summary;

  const attributes: Record<string, string | number> = {
    "crash.native.dumpCount": unreported.length,
  };
  if (primary !== undefined) {
    attributes["crash.native.exceptionCode"] = primary.exceptionCode;
    attributes["crash.native.exceptionAddress"] = primary.exceptionAddress;
    if (primary.module !== undefined) {
      attributes["crash.native.module"] = primary.module;
    }
    if (primary.moduleVersion !== undefined) {
      attributes["crash.native.moduleVersion"] = primary.moduleVersion;
    }
    if (primary.moduleOffset !== undefined) {
      attributes["crash.native.moduleOffset"] = primary.moduleOffset;
    }
    if (primary.processType !== undefined) {
      attributes["crash.native.processType"] = primary.processType;
    }
  }

  const error: ReportableError = {
    message: describeNativeCrash(primary, unreported.length),
    code: primary?.exceptionCode ?? "native-crash",
  };

  try {
    await reportCrash(
      "PreviousSessionCrash",
      error,
      undefined,
      "main",
      isTelemetryEnabled(),
      attributes,
    );
    log("info", "reported native crash from previous session", {
      dumps: unreported.length,
      exception: primary?.exceptionCode,
      module: primary?.module,
    });
    for (const dump of unreported) {
      await unlink(dump.path).catch(() => {
        /* ignored */
      });
    }
  } catch (err) {
    log("warn", "failed to report native crash, will retry next startup", {
      error: getErrorMessageOrDefault(err),
    });
  }
}

const MAX_PROCESSED_DUMPS = 5;

const describeNativeCrash = (summary: IMinidumpSummary | undefined, dumpCount: number): string => {
  if (summary === undefined) {
    return `Previous session crashed leaving ${dumpCount} unreadable crash dump(s)`;
  }
  const what =
    summary.exceptionName !== undefined
      ? `${summary.exceptionName} (${summary.exceptionCode})`
      : summary.exceptionCode;
  const where = summary.module !== undefined ? ` in ${summary.module}+${summary.moduleOffset}` : "";
  return `Previous session crashed: ${what}${where}`;
};

interface IDumpFile {
  path: string;
  mtimeMs: number;
}

/** Crashpad nests dumps in subdirectories (reports/, pending/), so walk shallowly. */
async function collectCrashDumps(): Promise<IDumpFile[]> {
  const found: IDumpFile[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && depth < 3) {
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".dmp")) {
        try {
          found.push({ path: fullPath, mtimeMs: (await stat(fullPath)).mtimeMs });
        } catch {
          // ignored
        }
      }
    }
  };
  await walk(app.getPath("crashDumps"), 0);
  return found;
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
  attributes?: Record<string, string | number | boolean>,
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
      ...attributes,
    });
    span.end();
  } finally {
    await provider.forceFlush();
    await provider.shutdown();
  }
}
