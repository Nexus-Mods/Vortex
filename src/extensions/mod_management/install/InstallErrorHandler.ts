/**
 * InstallErrorHandler - Strategy-based error handling for mod installation.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module uses the Strategy pattern to handle different error types:
 * - Each error type has its own handler
 * - Handlers are registered in a priority order
 * - The first matching handler processes the error
 */

import Bluebird from "bluebird";
import * as path from "path";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import type { IHashResult } from "modmeta-db";
import {
  ArchiveBrokenError,
  DataInvalid,
  ProcessCanceled,
  SetupError,
  TemporaryError,
  UserCanceled,
} from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import { truthy } from "../../../util/util";
import { prettifyNodeErrorMessage } from "../../../util/message";
import { isBrowserAssistantError } from "./errors";

/**
 * Context for error handling.
 * Contains all the state needed to handle installation errors.
 */
export interface IErrorContext {
  api: IExtensionApi;
  archivePath: string;
  archiveId: string;
  destinationPath: string | undefined;
  installContext: IInstallContext | undefined;
  unattended: boolean;
  info: any;
  promiseCallback?: (err: Error | null, modId: string | null) => void;
}

/**
 * Minimal interface for InstallContext to avoid circular dependencies.
 */
export interface IInstallContext {
  reportError: (
    title: string,
    message: string | Error,
    allowReport?: boolean,
    replace?: Record<string, any>,
  ) => void;
  finishInstallCB: (
    outcome: "success" | "failed" | "canceled",
    info?: any,
    reason?: string,
  ) => void;
}

/**
 * Result of error handling.
 */
export interface IErrorHandlerResult {
  /** Whether the error was handled */
  handled: boolean;
  /** Promise to await (for cleanup operations) */
  promise?: Bluebird<void>;
}

/**
 * Interface for error handlers.
 * Each handler is responsible for a specific error type.
 */
export interface IErrorHandler {
  /** Name of the handler for logging */
  name: string;
  /** Check if this handler can handle the error */
  canHandle(err: Error): boolean;
  /** Handle the error */
  handle(err: Error, ctx: IErrorContext): Bluebird<void>;
}

/**
 * Check if an error represents a cancellation.
 */
export function isCanceledError(err: any): boolean {
  return (
    err instanceof UserCanceled ||
    err instanceof TemporaryError ||
    err instanceof ProcessCanceled ||
    !truthy(err) ||
    err.message === "Canceled" ||
    (truthy(err.stack) &&
      err.stack.startsWith("UserCanceled: canceled by user"))
  );
}

/**
 * Clean up destination path if it exists.
 */
function cleanupDestination(
  destinationPath: string | undefined,
  installContext: IInstallContext | undefined,
): Bluebird<void> {
  if (destinationPath === undefined) {
    return Bluebird.resolve();
  }

  return fs
    .removeAsync(destinationPath)
    .catch(UserCanceled, () => null)
    .catch((innerErr) => {
      if (installContext) {
        installContext.reportError(
          'Failed to clean up installation directory "{{destinationPath}}", ' +
            "please close Vortex and remove it manually.",
          innerErr,
          innerErr.code !== "ENOTEMPTY",
          { destinationPath },
        );
      }
    })
    .then(() => undefined);
}

/**
 * Finish the install context with the appropriate outcome.
 */
function finishContext(
  api: IExtensionApi,
  installContext: IInstallContext | undefined,
  err: Error,
  canceled: boolean,
): Bluebird<void> {
  if (installContext === undefined) {
    return Bluebird.resolve();
  }

  const pretty = prettifyNodeErrorMessage(err);
  return Bluebird.resolve().then(() =>
    installContext.finishInstallCB(
      canceled ? "canceled" : "failed",
      undefined,
      api.translate(pretty.message, { replace: pretty.replace }),
    ),
  );
}

// ==================== Error Handlers ====================

/**
 * Handler for undefined errors.
 */
class UndefinedErrorHandler implements IErrorHandler {
  public name = "UndefinedError";

  public canHandle(err: Error): boolean {
    return err === undefined;
  }

  public handle(err: Error, ctx: IErrorContext): Bluebird<void> {
    return cleanupDestination(ctx.destinationPath, ctx.installContext).then(
      () => {
        ctx.promiseCallback?.(new Error("unknown error"), null);
      },
    );
  }
}

/**
 * Handler for canceled errors (UserCanceled, TemporaryError, ProcessCanceled).
 */
class CanceledErrorHandler implements IErrorHandler {
  public name = "CanceledError";

  public canHandle(err: Error): boolean {
    return isCanceledError(err);
  }

  public handle(err: Error, ctx: IErrorContext): Bluebird<void> {
    return cleanupDestination(ctx.destinationPath, ctx.installContext)
      .then(() => finishContext(ctx.api, ctx.installContext, err, true))
      .then(() => {
        ctx.promiseCallback?.(err, null);
      });
  }
}

/**
 * Handler for broken archive errors.
 */
class ArchiveBrokenErrorHandler implements IErrorHandler {
  public name = "ArchiveBrokenError";

  public canHandle(err: Error): boolean {
    return err instanceof ArchiveBrokenError;
  }

  public handle(err: Error, ctx: IErrorContext): Bluebird<void> {
    return cleanupDestination(ctx.destinationPath, ctx.installContext)
      .then(() => finishContext(ctx.api, ctx.installContext, err, false))
      .then(() => {
        if (ctx.unattended) {
          ctx.promiseCallback?.(err, null);
          return;
        }

        if (ctx.installContext !== undefined) {
          ctx.api.sendNotification({
            type: "info",
            title: "Installation failed, archive is damaged",
            message: path.basename(ctx.archivePath),
            actions: [
              {
                title: "Delete",
                action: (dismiss) => {
                  ctx.api.events.emit(
                    "remove-download",
                    ctx.archiveId,
                    dismiss,
                  );
                },
              },
              {
                title: "Delete & Redownload",
                action: (dismiss) => {
                  const state: IState = ctx.api.store.getState();
                  const download =
                    state.persistent.downloads.files[ctx.archiveId];
                  ctx.api.events.emit("remove-download", ctx.archiveId, () => {
                    dismiss();
                    ctx.api.events.emit(
                      "start-download",
                      download.urls,
                      ctx.info.download,
                      path.basename(ctx.archivePath),
                    );
                  });
                  dismiss();
                },
              },
            ],
          });
        }
      });
  }
}

/**
 * Handler for setup errors.
 */
class SetupErrorHandler implements IErrorHandler {
  public name = "SetupError";

  public canHandle(err: Error): boolean {
    return err instanceof SetupError;
  }

  public handle(err: Error, ctx: IErrorContext): Bluebird<void> {
    return cleanupDestination(ctx.destinationPath, ctx.installContext)
      .then(() => finishContext(ctx.api, ctx.installContext, err, false))
      .then(() => {
        if (ctx.installContext !== undefined) {
          ctx.installContext.reportError("Installation failed", err, false, {
            installerPath: path.basename(ctx.archivePath),
            message: err.message,
          });
        }
        ctx.promiseCallback?.(err, null);
      });
  }
}

/**
 * Handler for data invalid errors.
 */
class DataInvalidErrorHandler implements IErrorHandler {
  public name = "DataInvalidError";

  public canHandle(err: Error): boolean {
    return err instanceof DataInvalid;
  }

  public handle(err: Error, ctx: IErrorContext): Bluebird<void> {
    return cleanupDestination(ctx.destinationPath, ctx.installContext)
      .then(() => finishContext(ctx.api, ctx.installContext, err, false))
      .then(() => {
        if (ctx.installContext !== undefined) {
          ctx.installContext.reportError(
            "Installation failed",
            "The installer {{ installerPath }} is invalid and couldn't be " +
              "installed:\n{{ message }}\nPlease inform the mod author.\n",
            false,
            {
              installerPath: path.basename(ctx.archivePath),
              message: err.message,
            },
          );
        }
        ctx.promiseCallback?.(err, null);
      });
  }
}

/**
 * Handler for module not found errors.
 */
class ModuleNotFoundHandler implements IErrorHandler {
  public name = "ModuleNotFound";

  public canHandle(err: any): boolean {
    return err?.code === "MODULE_NOT_FOUND";
  }

  public handle(err: any, ctx: IErrorContext): Bluebird<void> {
    return cleanupDestination(ctx.destinationPath, ctx.installContext)
      .then(() => finishContext(ctx.api, ctx.installContext, err, false))
      .then(() => {
        const location =
          err.requireStack !== undefined ? ` (at ${err.requireStack[0]})` : "";

        if (ctx.installContext !== undefined) {
          ctx.installContext.reportError(
            "Installation failed",
            "Module failed to load:\n{{message}}{{location}}\n\n" +
              "This usually indicates that the Vortex installation has been " +
              "corrupted or an external application (like an Anti-Virus) has interfered with " +
              "the loading of the module. " +
              "Please check whether your AV reported something and try reinstalling Vortex.",
            false,
            {
              location,
              message: err.message.split("\n")[0],
            },
          );
        }
        ctx.promiseCallback?.(err, null);
      });
  }
}

/**
 * Fallback handler for generic errors.
 */
class GenericErrorHandler implements IErrorHandler {
  public name = "GenericError";

  public canHandle(err: Error): boolean {
    return true; // Catch-all handler
  }

  public handle(err: any, ctx: IErrorContext): Bluebird<void> {
    return cleanupDestination(ctx.destinationPath, ctx.installContext)
      .then(() => finishContext(ctx.api, ctx.installContext, err, false))
      .then(() => ctx.api.genMd5Hash(ctx.archivePath).catch(() => ({})))
      .then((hashResult: IHashResult) => {
        const id = `${path.basename(ctx.archivePath)} (md5: ${hashResult.md5sum})`;
        let replace = {};
        let errorToReport = err;

        if (typeof err === "string") {
          errorToReport = 'The installer "{{ id }}" failed: {{ message }}';
          replace = {
            id,
            message: err,
          };
        }

        if (ctx.installContext !== undefined) {
          const browserAssistantMsg =
            "The installer has failed due to an external 3rd " +
            "party application you have installed on your system named " +
            '"Browser Assistant". This application inserts itself globally ' +
            "and breaks any other application that uses the same libraries as it does.\n\n" +
            'To use Vortex, please uninstall "Browser Assistant".';

          const errorMessage = typeof err === "string" ? err : err.message;
          let allowReport: boolean | undefined;

          if (err.message?.includes("No compatible .NET installation")) {
            allowReport = false;
          }

          if (!isBrowserAssistantError(errorMessage)) {
            ctx.installContext.reportError(
              "Installation failed",
              errorToReport,
              allowReport,
              replace,
            );
          } else {
            ctx.installContext.reportError(
              "Installation failed",
              browserAssistantMsg,
              false,
            );
          }
        }
        ctx.promiseCallback?.(err, null);
      });
  }
}

// ==================== Registry ====================

/**
 * Default error handlers in priority order.
 * The first handler that can handle the error will be used.
 */
const DEFAULT_HANDLERS: IErrorHandler[] = [
  new UndefinedErrorHandler(),
  new CanceledErrorHandler(),
  new ArchiveBrokenErrorHandler(),
  new SetupErrorHandler(),
  new DataInvalidErrorHandler(),
  new ModuleNotFoundHandler(),
  new GenericErrorHandler(), // Must be last
];

/**
 * InstallErrorHandler - Registry of error handlers.
 *
 * Uses Strategy pattern to handle different error types.
 * Handlers are evaluated in registration order; first match wins.
 */
export class InstallErrorHandler {
  private mHandlers: IErrorHandler[];

  constructor(handlers: IErrorHandler[] = DEFAULT_HANDLERS) {
    this.mHandlers = handlers;
  }

  /**
   * Handle an installation error.
   *
   * @param err - The error to handle
   * @param ctx - The error context
   * @returns Promise that resolves when error handling is complete
   */
  public handle(err: Error, ctx: IErrorContext): Bluebird<void> {
    const handler = this.mHandlers.find((h) => h.canHandle(err));
    if (handler) {
      return handler.handle(err, ctx);
    }

    // Should never reach here with default handlers, but just in case
    return Bluebird.resolve();
  }

  /**
   * Check if an error would be treated as a cancellation.
   */
  public isCanceled(err: Error): boolean {
    return isCanceledError(err);
  }

  /**
   * Get the list of registered handlers.
   */
  public getHandlers(): readonly IErrorHandler[] {
    return this.mHandlers;
  }
}

/**
 * Create an error context from install parameters.
 */
export function createErrorContext(
  api: IExtensionApi,
  archivePath: string,
  archiveId: string,
  destinationPath: string | undefined,
  installContext: IInstallContext | undefined,
  unattended: boolean,
  info: any,
  promiseCallback?: (err: Error | null, modId: string | null) => void,
): IErrorContext {
  return {
    api,
    archivePath,
    archiveId,
    destinationPath,
    installContext,
    unattended,
    info,
    promiseCallback,
  };
}
