import type PromiseBB from "bluebird";
import type { BrowserWindow } from "electron";

import {
  type Span,
  context,
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { unknownToError } from "@vortex/shared";
import { recordErrorOnSpan } from "@vortex/shared/telemetry";
import { ipcRenderer } from "electron";
import * as fs from "fs-extra";
import I18next from "i18next";
import * as path from "path";
import * as semver from "semver";
import { inspect } from "util";
import {} from "uuid";

import type { IErrorOptions, IExtensionApi } from "../types/api";
import type { IError } from "../types/IError";

import { isTelemetryEnabled } from "../telemetry/selectors";
import { getApplication } from "./application";
import { COMPANY_ID } from "./constants";
import { UserCanceled } from "./CustomErrors";
import getVortexPath from "./getVortexPath";
import { fallbackTFunc } from "./i18n";
import { log } from "./log";
import { flatten, getAllPropertyNames, spawnSelf } from "./util";

// Async dialog helpers for cross-process compatibility
const showMessageBox = async (
  options: Electron.MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> => {
  return window.api.dialog.showMessageBox(options);
};

const showErrorBox = async (title: string, content: string): Promise<void> => {
  return window.api.dialog.showErrorBox(title, content);
};

type IErrorContext = Record<string, string>;

const globalContext: IErrorContext = {};

export function createErrorReport(
  type: string,
  error: IError,
  context: IErrorContext,
  state: any,
  sourceProcess?: string,
) {
  const userData = getVortexPath("userData");
  const reportPath = path.join(userData, "crashinfo.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      type,
      error,
      context,
      reportProcess: process.type,
      sourceProcess,
      userData,
    }),
  );
  if (isTelemetryEnabled(state)) {
    spawnSelf(["--report", reportPath]);
  }
}

let outdated: boolean = false;
let errorIgnored: boolean = false;

export function setOutdated(api: IExtensionApi) {
  if (process.env.NODE_ENV === "development") {
    return;
  }
  const state = api.store?.getState();
  const version = getApplication().version;
  if (state.persistent.nexus?.newestVersion !== undefined) {
    try {
      outdated = semver.lt(version, state.persistent.nexus.newestVersion);
    } catch (err) {
      // not really a big issue
      log("warn", "failed to update outdated status", err);
    }
  }
  api.onStateChange?.(
    ["persistent", "nexus", "newestVersion"],
    (prev, next) => {
      outdated = semver.lt(version, next);
    },
  );
}

export function isOutdated(): boolean {
  return outdated;
}

export function didIgnoreError(): boolean {
  return errorIgnored;
}

export function disableErrorReport() {
  log("info", "user ignored error, disabling reporting");
  errorIgnored = true;
}

if (ipcRenderer !== undefined) {
  ipcRenderer.on("did-ignore-error", () => {
    log("info", "user ignored error, disabling reporting");
    errorIgnored = true;
  });
}

let defaultWindow: BrowserWindow | null = null;

export function setWindow(window: BrowserWindow | null): void {
  defaultWindow = window;
}

export function getWindow(): BrowserWindow | null {
  return defaultWindow;
}

const currentWindow: BrowserWindow | null = null;

function getCurrentWindow(): BrowserWindow | null {
  // In renderer process, we can't access BrowserWindow directly
  // The preload API handles window references internally via windowId
  if (process.type === "renderer") {
    return null;
  }
  return currentWindow;
}

export function getVisibleWindow(
  win?: BrowserWindow | null,
): BrowserWindow | null {
  if (!win) {
    win = getCurrentWindow() ?? getWindow();
  }

  return win !== null && !win.isDestroyed() && win.isVisible() ? win : null;
}

async function showTerminateError(
  error: IError,
  state: any,
  source: string | undefined,
  allowReport: boolean | undefined,
  withDetails: boolean,
): Promise<boolean> {
  const buttons = ["Ignore", "Quit"];
  if (!withDetails) {
    buttons.unshift("Show Details");
  }
  if (allowReport !== false && !outdated && !errorIgnored) {
    buttons.push("Report and Quit");
  }

  const contextNow = { ...globalContext };

  let detail: string | undefined = error.details;
  if (withDetails) {
    detail = error.stack || "";
    if (error.path) {
      detail = "File: " + error.path + "\n" + detail;
    }
    if (error.code) {
      detail = error.code + "\n" + detail;
    }
    if (error.details) {
      detail = error.details + "\n" + detail;
    }
  }

  let result = await showMessageBox({
    type: "error",
    buttons,
    defaultId: buttons.length - 1,
    title: "An unrecoverable error occurred",
    message: error.message,
    detail,
    noLink: true,
  });

  if (buttons[result.response] === "Report and Quit") {
    // Report
    createErrorReport("Crash", error, contextNow, state, source);
  } else if (buttons[result.response] === "Ignore") {
    // Ignore
    result = await showMessageBox({
      type: "error",
      buttons: ["Quit", "I understand"],
      title: "Are you sure?",
      message:
        "The error was unhandled which may lead to unforeseen consequences including data loss. " +
        "Continue at your own risk. Please do not report any issues that arise from here on out, as they are very likely to be caused by the unhandled error. ",
      noLink: true,
    });
    if (result.response === 1) {
      log("info", "user ignored error, disabling reporting");
      errorIgnored = true;
      return true;
    }
  } else if (buttons[result.response] === "Show Details") {
    return showTerminateError(error, state, source, allowReport, true);
  }
  return false;
}

/**
 * display an error message and quit the application
 * on confirmation.
 * Use this whenever the application state is unknown and thus
 * continuing could lead to data loss
 *
 * @export
 * @param {ITermination} error
 */
export function terminate(
  error: IError,
  state: any,
  allowReport?: boolean,
  source?: string,
) {
  if (allowReport === undefined && error.allowReport === false) {
    allowReport = false;
  }

  if (allowReport === undefined && error.extension !== undefined) {
    allowReport = error.extension === COMPANY_ID;
  }

  log("error", "unrecoverable error", { error, process: process.type });

  // Use an async IIFE to handle the async dialog calls
  void (async () => {
    try {
      if (await showTerminateError(error, state, source, allowReport, false)) {
        // ignored
        return;
      }

      if (error.extension !== undefined) {
        const result = await showMessageBox({
          type: "error",
          buttons: ["Disable", "Keep"],
          title: "Extension crashed",
          message:
            `This crash was caused by an extension (${error.extension}). ` +
            "Do you want to disable this extension? All functionality provided " +
            "by the extension will be removed from Vortex!",
          noLink: true,
        });
        if (result.response === 0) {
          log("warn", "extension will be disabled after causing a crash", {
            extId: error.extension,
            error: error.message,
            stack: error.stack,
          });
          // can't access the store at this point because we won't be waiting for the store
          // to be persisted
          fs.writeFileSync(
            path.join(getVortexPath("temp"), "__disable_" + error.extension),
            "",
          );
        }
      }
    } catch (err) {
      // if the crash occurs before the application is ready, the dialog module can't be
      // used (except for this function)
      await showErrorBox(
        "An unrecoverable error occurred",
        error.message +
          "\n" +
          error.details +
          "\nIf you think this is a bug, please report it to the " +
          "issue tracker (github)",
      );
    }

    getApplication().quit(1);
  })();

  // Throw immediately to stop execution in the calling code
  throw new UserCanceled();
}

/**
 * render error message for internal processing (issue tracker and such).
 * It's important this doesn't translate the error message or lose information
 */
export function toError(
  input: any,
  title?: string,
  options?: IErrorOptions,
  sourceStack?: string,
): IError {
  let ten = I18next.getFixedT("en");
  try {
    ten("dummy");
  } catch (err) {
    // can't actually be sure if i18next is initialized - especially if this is the
    // main process. We could use require('i18next').isInitialized but no clue if
    // that's reliable.
    ten = fallbackTFunc;
  }

  const subtitle = (options || {}).message;

  /* i18next-extract-disable-next-line */
  const t = (text: string) => ten(text, { replace: (options || {}).replace });

  if (input instanceof Error) {
    let stack = input.stack;
    if (sourceStack !== undefined) {
      stack += "\n\nReported from:\n" + sourceStack;
    }
    const flatErr = flatten(input);
    return {
      /* i18next-extract-disable-next-line */
      message: t(input.message),
      title,
      subtitle,
      stack,
      allowReport: input["allowReport"],
      details: Object.keys(flatErr)
        .filter((key) => key !== "allowReport")
        .map((key) => `${key}: ${flatErr[key]}`)
        .join("\n"),
    };
  }

  switch (typeof input) {
    case "object": {
      // object, but not an Error
      let message: string;
      let stack: string | undefined;
      if (!input || getAllPropertyNames(input).length === 0) {
        // this is bad...
        message = `An empty error message was thrown: "${inspect(input)}"`;
      } else if (input.error !== undefined && input.error instanceof Error) {
        message = input.error.message;
        stack = input.error.stack;
      } else {
        message = input.message;
        if (input.message === undefined) {
          if (input.error !== undefined) {
            // not sure what this is but need to ensure not to drop any information
            message = inspect(input.error);
          } else if (Object.keys(input).length > 0) {
            // wtf is this???
            message = inspect(input);
          } else {
            message = "An error occurred";
          }
        }
        stack = input.stack;
      }

      if (sourceStack !== undefined) {
        if (stack === undefined) {
          stack = sourceStack;
        } else {
          stack += "\n\nReported from:\n" + sourceStack;
        }
      }

      const flatErr = flatten(input);

      let attributes = Object.keys(flatErr || {}).filter(
        (key) => key[0].toUpperCase() === key[0],
      );
      // if there are upper case characters, this is a custom, not properly typed, error object
      // with upper case attributes, intended to be displayed to the user.
      // Otherwise, who knows what this is, just send everything.
      if (attributes.length === 0) {
        attributes = getAllPropertyNames(flatErr || {}).filter(
          (key) => ["message", "error", "stack", "context"].indexOf(key) === -1,
        );
      }

      const details =
        attributes.length === 0
          ? undefined
          : attributes.map((key) => key + ":\t" + input[key]).join("\n");

      return { message, title, subtitle, stack, details };
    }
    case "string": {
      /* i18next-extract-disable-next-line */
      return { message: "String exception: " + t(input), title, subtitle };
    }
    default: {
      return {
        message: "Unknown exception: " + inspect(input),
        title,
        subtitle,
      };
    }
  }
}

/**
 * set an error context, that will be reported with every error reported.
 * Please keep in mind that the error context will remain set
 * until it's cleared with clearErrorContext and use "withContext" where possible
 * to ensure the context gets reset
 * @param id context id
 * @param value context value
 */
export function setErrorContext(id: string, value: string) {
  globalContext[id] = value;
}

/**
 * clear an error context
 * @param id id of the context
 */
export function clearErrorContext(id: string) {
  delete globalContext[id];
}

/**
 * execute a function with the specified error context
 * @param id identifier of the context to set
 * @param value context value
 * @param fun the function to set
 */
export function withContext(
  id: string,
  value: string,
  fun: () => PromiseBB<any>,
) {
  return withTrackedActivity(
    "vortex.context",
    id,
    { "context.value": value },
    () => fun(),
    { root: true },
  );
}

/**
 * attach context to an error that may be caught after the global context has been reset
 * @param err the error to add context to
 */
export function contextify(err: Error): Error {
  (err as any).context = getErrorContext();
  return err;
}

export function getErrorContext(): IErrorContext {
  return { ...globalContext };
}

export type SetAttribute = (
  key: string,
  value: string | number | boolean,
) => void;

export type SetError = (error: Error) => void;

export type TrackedFunction<T> = (
  setAttribute: SetAttribute,
  setError: SetError,
) => PromiseBB<T> | Promise<T>;

export interface TrackedActivityOptions {
  /** Start a new root trace instead of inheriting the active parent span. */
  root?: boolean;
}

/**
 * Execute a function wrapped in an OTel span with full control over
 * tracer name, span name, and attributes.
 * The span is automatically ended when the returned promise settles.
 * The callback receives a `setAttribute` function for adding dynamic attributes.
 *
 * Pass `{ root: true }` for top-level operations (downloads, installs) that
 * should start a new trace rather than becoming children of whatever span
 * happens to be active in the Bluebird chain.
 */
export function withTrackedActivity<T>(
  tracerName: string,
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fun: TrackedFunction<T>,
  options?: TrackedActivityOptions,
): Promise<T> {
  const tracer = trace.getTracer(tracerName);

  // Attach ambient context (active game mode, extension version, etc.)
  const contextAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(globalContext)) {
    contextAttributes[`context.${key}`] = value;
  }
  const spanOptions = { attributes: { ...contextAttributes, ...attributes } };
  const spanFn = async (span: Span): Promise<T> => {
    const recordError = (error: Error) => {
      recordErrorOnSpan(span, error, getApplication().version);
    };

    let hasError = false;
    try {
      const result = await fun(
        (key, value) => span.setAttribute(key, value),
        (error) => {
          hasError = true;
          recordError(error);
        },
      );
      span.setStatus({
        code: hasError ? SpanStatusCode.ERROR : SpanStatusCode.OK,
      });
      return result;
    } catch (unknownErr) {
      const err = unknownToError(unknownErr);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err?.message,
      });
      recordError(err);
      throw err;
    } finally {
      span.end();
    }
  };
  return options?.root === true
    ? tracer.startActiveSpan(spanName, spanOptions, ROOT_CONTEXT, spanFn)
    : tracer.startActiveSpan(spanName, spanOptions, spanFn);
}

function applyErrorToSpan(
  span: Span,
  title: string,
  error: Error,
  attributes?: Record<string, string | number | boolean>,
): void {
  span.setAttribute("error.title", title);
  recordErrorOnSpan(
    span,
    error,
    getApplication().version,
    globalContext,
    attributes,
  );
}

/**
 * Record an error on the currently active span, or create a new root span
 * if none exists. The RingBufferSpanProcessor will detect the ERROR status
 * and export the trace automatically.
 */
export function recordErrorSpan(
  title: string,
  error: Error,
  attributes?: Record<string, string | number | boolean>,
): void {
  const activeSpan = trace.getSpan(context.active());

  if (activeSpan !== undefined) {
    applyErrorToSpan(activeSpan, title, error, attributes);
  } else {
    // No active span — create a new root span for this orphan error
    const tracer = trace.getTracer("vortex.errors");
    tracer.startActiveSpan(
      "error.report",
      { attributes: { "error.title": title, ...attributes } },
      ROOT_CONTEXT,
      (span) => {
        applyErrorToSpan(span, title, error, attributes);
        span.end();
      },
    );
  }
}
