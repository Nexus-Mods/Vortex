import type { IFeedbackResponse } from "@nexusmods/nexus-api";
import type ZipT from "node-7z";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import PromiseBB from "bluebird";
import * as _ from "lodash";
import * as os from "os";
import * as path from "path";
import { file as tmpFile, tmpName } from "tmp";

/* disable-eslint */
import type { IDialogAction, IDialogContent } from "../actions/notifications";
import type { IAttachment, IErrorOptions } from "../types/IExtensionContext";
import type { IState } from "../types/IState";
import type { HTTPError } from "./CustomErrors";

import { addNotification, showDialog } from "../actions/notifications";
import { NoDeployment } from "../extensions/mod_management/util/exceptions";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { jsonRequest } from "./network";
import {
  StalledError,
  TemporaryError,
  ThirdPartyError,
  ArchiveBrokenError,
  UserCanceled,
} from "./CustomErrors";
import {
  didIgnoreError,
  getErrorContext,
  isOutdated,
  sendReport,
  toError,
} from "./errorHandling";
import * as fs from "./fs";
import getVortexPath from "./getVortexPath";
import { log } from "./log";
import { decodeSystemError } from "./nativeErrors";
import opn from "./opn";
import { flatten, nexusModsURL, setdefault, truthy } from "./util";

const GITHUB_PROJ = "Nexus-Mods/Vortex";

function clamp(min: number, value: number, max: number): number {
  return Math.max(max, Math.min(min, value));
}

/**
 * calculate a reasonable time to display a message based on the
 * amount of text.
 * This is quite crude because the reading speed differs between languages.
 * Japanese and Chinese for example where a single symbol has much more meaning
 * than a latin character the reading speed per symbol will be lower.
 *
 * @export
 * @param {number} messageLength
 * @returns
 */
export function calcDuration(messageLength: number) {
  return clamp(2000, messageLength * 50, 7000);
}

/**
 * show a notification that some operation succeeded. This message has a timer based on
 * the message length
 *
 * @export
 * @template S
 * @param {Redux.Dispatch<S>} dispatch
 * @param {string} message
 * @param {string} [id]
 */
export function showSuccess<S>(
  dispatch: ThunkDispatch<IState, null, Redux.Action>,
  message: string,
  id?: string,
) {
  // show message for 2 to 7 seconds, depending on message length
  dispatch(
    addNotification({
      id,
      type: "success",
      message,
      displayMS: calcDuration(message.length),
    }),
  );
}

/**
 * show activity notification
 */
export function showActivity<S>(
  dispatch: ThunkDispatch<IState, null, Redux.Action>,
  message: string,
  id?: string,
) {
  dispatch(
    addNotification({
      id,
      type: "activity",
      message,
    }),
  );
}

/**
 * show an info notification. Please don't use this for important stuff as the message
 * has a timer based on message length
 *
 * @export
 * @template S
 * @param {Redux.Dispatch<S>} dispatch
 * @param {string} message
 * @param {string} [id]
 */
export function showInfo<S>(
  dispatch: ThunkDispatch<IState, null, Redux.Action>,
  message: string,
  id?: string,
) {
  // show message for 2 to 7 seconds, depending on message length
  dispatch(
    addNotification({
      id,
      type: "info",
      message,
      displayMS: calcDuration(message.length),
    }),
  );
}

function genGithubUrl(issueId: number) {
  return `https://github.com/Nexus-Mods/Vortex/issues/${issueId}`;
}

function genFeedbackText(
  response: IFeedbackResponse,
  githubInfo?: any,
): string {
  const lines = [
    "Thank you for your feedback!",
    "",
    "If you're reporting a bug, please don't forget to leave additional " +
      "information in the form that should have opened in your webbrowser.",
    "",
  ];

  if (response.github_issue === undefined) {
    lines.push("Your feedback will be reviewed before it is published.");
  } else {
    if (
      (githubInfo !== undefined && githubInfo.state === "closed") ||
      response.github_issue.issue_state === "closed"
    ) {
      lines.push(
        "This issue was reported before and seems to be fixed already. " +
          "If you're not running the newest version of Vortex, please update.",
      );
    } else if (
      (githubInfo !== undefined && githubInfo.comments >= 1) ||
      response.count > 1
    ) {
      lines.push(
        "This is not the first report about this problem, so your report " +
          "was added as a comment to the existing one.",
      );
    } else {
      lines.push("You were the first to report this issue.");
    }
    const url = genGithubUrl(response.github_issue.issue_number);
    lines.push(`You can review the created issue on [url]${url}[/url]`);
  }

  return lines.join("[br][/br]");
}

const noReportErrors = [
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ENETUNREACH",
];

function shouldAllowReport(
  err: string | Error | any,
  options?: IErrorOptions,
): boolean {
  if (
    options?.allowReport === false ||
    options?.warning === true ||
    err instanceof ThirdPartyError ||
    err instanceof UserCanceled
  ) {
    return false;
  }

  if (err instanceof UserCanceled) {
    log("debug", "Incorrectly handled UserCanceled error", {
      stack: err.stack,
    });
  }
  return !noReportErrors.includes(err.code);
}

function dataToFile(id, input: any) {
  return new PromiseBB<string>((resolve, reject) => {
    const data: Buffer = Buffer.from(JSON.stringify(input));
    tmpFile(
      {
        prefix: id,
        postfix: ".json",
      },
      (err, tmpPath: string, fd: number, cleanup: () => void) => {
        if (err !== null) {
          return reject(err);
        }
        fs.writeAsync(fd, data, 0, data.byteLength, 0)
          .then(() => fs.closeAsync(fd))
          .then(() => {
            resolve(tmpPath);
          })
          .catch((innerErr) => {
            log("error", "failed to write attachment data to file", {
              error: getErrorMessageOrDefault(innerErr),
            });
            return reject(innerErr);
          });
      },
    );
  });
}

function zipFiles(files: string[]): PromiseBB<string | undefined> {
  if (files.length === 0) {
    return PromiseBB.resolve(undefined);
  }
  const Zip: typeof ZipT = require("node-7z");
  const task: ZipT = new Zip();

  return new PromiseBB<string>((resolve, reject) => {
    tmpName(
      {
        postfix: ".7z",
      },
      (err, tmpPath: string) => (err !== null ? reject(err) : resolve(tmpPath)),
    );
  }).then((tmpPath) =>
    task.add(tmpPath, files, { ssw: true }).then(() => tmpPath),
  );
}

function serializeAttachments(input: IAttachment): PromiseBB<string> {
  if (input.type === "file") {
    return input.data;
  } else {
    return dataToFile(input.id, input.data);
  }
}

export function bundleAttachment(
  options?: IErrorOptions,
): PromiseBB<string | undefined> {
  if (
    options === undefined ||
    options.attachments === undefined ||
    options.attachments.length === 0
  ) {
    return PromiseBB.resolve(undefined);
  }

  return PromiseBB.reduce(
    options.attachments,
    (accum: string[], iter: IAttachment) => {
      if (iter.type === "file") {
        return fs
          .statAsync(iter.data)
          .then(() => serializeAttachments(iter))
          .then((fileName) => {
            accum.push(fileName);
            return accum;
          })
          .catch((err) => accum);
      } else {
        return serializeAttachments(iter).then((fileName) => {
          accum.push(fileName);
          return accum;
        });
      }
    },
    [],
  ).then((fileNames) => zipFiles(fileNames));
}

/**
 * show an error notification with an optional "more" button that displays further details
 * in a modal dialog.
 *
 * @export
 * @param {Redux.Dispatch<S>} dispatch
 * @param {string} title
 * @param {any} [details] further details about the error (stack and such). The api says we only
 *                        want string or Errors but since some node apis return non-Error objects
 *                        where Errors are expected we have to be a bit more flexible here.
 */
export function showError(
  dispatch: ThunkDispatch<IState, null, Redux.Action>,
  title: string,
  details?: string | Error | any,
  options?: IErrorOptions,
) {
  if (options === undefined) {
    options = {};
  }
  const sourceErr = new Error();

  if (
    options.extensionName === undefined &&
    details?.["extensionName"] !== undefined
  ) {
    options.extensionName = details["extensionName"];
  }

  const err = renderError(details, options);

  const allowReport =
    err.allowReport !== undefined
      ? err.allowReport
      : shouldAllowReport(details, options);

  log(allowReport ? "error" : "warn", title, err);

  const content: IDialogContent =
    truthy(options) && options.isHTML
      ? {
          htmlText: err.message || err.text,
          options: {
            wrap: false,
          },
        }
      : options.isBBCode === true
        ? {
            bbcode: err.message || err.text,
            options: {
              wrap: false,
            },
          }
        : {
            text: err.text,
            message: err.message,
            options: {
              wrap: err.wrap,
              hideMessage: options.hideDetails !== false,
              // don't try to translate error messages
              translated: err.translated,
            },
            parameters: {
              ...(options.replace || {}),
              ...(err.parameters || {}),
            },
          };

  if (
    details?.["attachLogOnReport"] === true &&
    (options.attachments ?? []).find((iter) => iter.id === "log") === undefined
  ) {
    options.attachments = setdefault(
      options,
      "attachments",
      Array<IAttachment>(),
    )?.concat([
      {
        id: "log",
        type: "file",
        data: path.join(getVortexPath("userData"), "vortex.log"),
        description: "Vortex Log",
      },
      {
        id: "log2",
        type: "file",
        data: path.join(getVortexPath("userData"), "vortex1.log"),
        description: "Vortex Log (old)",
      },
    ]);
  }

  if (details?.["attachFilesOnReport"] !== undefined) {
    options.attachments = setdefault(
      options,
      "attachments",
      Array<IAttachment>(),
    )?.concat(
      details["attachFilesOnReport"].map((filePath: string, idx: number) => ({
        id: `file${idx}`,
        type: "file",
        data: filePath,
        description: path.basename(filePath),
      })),
    );
  }

  if (
    options.attachments !== undefined &&
    options.attachments.length > 0 &&
    allowReport
  ) {
    content.text =
      (content.text !== undefined ? content.text + "\n\n" : "") +
      "Note: If you report this error, the following data will be added to the report:\n" +
      options.attachments
        .map((attach) => ` - ${attach.description}`)
        .join("\n");
  }

  let extIssueTrackerURL: string | undefined = undefined;
  if (options.extension?.info?.issueTrackerURL !== undefined) {
    extIssueTrackerURL = options.extension.info.issueTrackerURL;
  } else if (options.extension?.info?.modId !== undefined) {
    extIssueTrackerURL = nexusModsURL(
      ["site", "mods", options.extension.info.modId.toString()],
      { parameters: ["tab=bugs"] },
    );
  } else if (options.extensionRemote?.github !== undefined) {
    extIssueTrackerURL =
      "https://github.com/" + options.extensionRemote?.github + "/issues";
  }

  if (
    options.extension !== undefined &&
    options.extensionName !== undefined &&
    extIssueTrackerURL === undefined
  ) {
    content.text =
      (content.text !== undefined ? content.text + "\n\n" : "") +
      `Note: This error was generated by "${options.extensionName}", please report ` +
      "it to the extension author.";
  }

  const actions: IDialogAction[] = [];

  const context = details?.context ?? getErrorContext();

  if (!isOutdated() && !didIgnoreError() && allowReport) {
    if (extIssueTrackerURL !== undefined) {
      actions.push({
        label: "Report",
        action: () => {
          dispatch(
            showDialog(
              "info",
              "Reporting to extension author",
              {
                bbcode:
                  "Since this error was very likely caused by a third-party extension, " +
                  "we will now take you to their issue tracker at [b]{{url}}[/b].<br/><br/>" +
                  "It usually helps a lot investigating issues if you provide your log files " +
                  "(found at [url]{{logPath}}[/url]) " +
                  "but please do keep in mind that those can contain personally identifiable " +
                  "information (like folder names that include your windows account name) " +
                  "or stuff like information about mods you are using.",
                parameters: {
                  url: extIssueTrackerURL,
                  logPath: getVortexPath("userData"),
                },
              },
              [
                { label: "Cancel" },
                {
                  label: "Continue",
                  action: () => opn(extIssueTrackerURL).catch(() => null),
                },
              ],
            ),
          );
        },
      });
    } else if (options.extension === undefined) {
      actions.push({
        label: "Report",
        action: () =>
          bundleAttachment(options)
            .then((attachmentBundle) =>
              sendReport(
                "error",
                toError(details, title, options, sourceErr.stack),
                context,
                ["error"],
                "",
                process.type,
                undefined,
                attachmentBundle,
              ),
            )
            .then((response) => {
              if (response?.github_issue !== undefined) {
                const { issue_number } = response.github_issue;
                const githubURL = `https://api.github.com/repos/${GITHUB_PROJ}/issues/${issue_number}`;
                jsonRequest<any>(githubURL)
                  .catch(() => undefined)
                  .then((githubInfo) => {
                    dispatch(
                      showDialog(
                        "success",
                        "Issue reported",
                        {
                          bbcode: genFeedbackText(response, githubInfo),
                        },
                        [{ label: "Close" }],
                      ),
                    );
                  });
              }
            }),
      });
    }
  }

  actions.push({ label: "Close", default: true });

  const haveMessage = options.message !== undefined;

  dispatch(
    addNotification({
      id: options.id,
      type: options?.warning ? "warning" : "error",
      title: haveMessage ? title : undefined,
      message: haveMessage ? options.message : title,
      allowSuppress: options.allowSuppress,
      replace: options.replace,
      actions:
        details !== undefined
          ? [
              ...(options.actions ?? []),
              {
                title: "More",
                action: (dismiss: () => void) => {
                  dispatch(showDialog("error", "Error", content, actions));
                },
              },
            ]
          : [],
    }),
  );
}

export interface IPrettifiedError extends Error {
  code?: string;
  replace?: Record<string, string>;
  allowReport?: boolean;
}

// err is typed as `any` because this function handles many different error shapes
// with varying properties (.code, .syscall, .path, .host, .address, .filename, etc.)
// that don't share a common type. This is a reasonable use of `any` at a system boundary.
export function prettifyNodeErrorMessage(
  err: any,
  options?: IErrorOptions,
  fileName?: string,
): IPrettifiedError {
  const result = prettifyNodeErrorMessageInner(err, options, fileName);
  // Extend the original error in-place to preserve its identity (instanceof checks)
  err.message = result.message;
  if (result.code !== undefined) {
    err.code = result.code;
  }
  if (result.replace !== undefined) {
    err.replace = result.replace;
  }
  if (result.allowReport !== undefined) {
    err.allowReport = result.allowReport;
  }
  return err;
}

interface IPrettifiedFields {
  message: string;
  code?: string;
  replace?: Record<string, string>;
  allowReport?: boolean;
  stack?: string;
}

function prettifyNodeErrorMessageInner(
  err: any,
  options?: IErrorOptions,
  fileName?: string,
): IPrettifiedFields {
  const decoded = decodeSystemError(err, err.path ?? err.filename ?? fileName);
  if (decoded !== undefined) {
    return {
      message: decoded.message,
      replace: { path: err.path ?? err.filename },
      allowReport: false,
    };
  }

  if (err instanceof ThirdPartyError || err instanceof ArchiveBrokenError) {
    const message =
      err instanceof ArchiveBrokenError
        ? "The archive appears to be broken/corrupted. Please delete it and try again.\n" +
          "If downloaded via a collection, pause the collection, remove the archive, and resume the collection.\n" +
          (err.fileName ? "Archive: " + err.fileName : err.message)
        : err.message;
    return {
      message,
      stack: err.stack,
      allowReport: false,
    };
  } else if (err instanceof TemporaryError) {
    return {
      message: err.message,
      allowReport: false,
    };
  } else if (err instanceof NoDeployment) {
    return {
      message:
        "No supported deployment method selected, " +
        "please review the deployment settings in Settings->Mods",
      allowReport: false,
    };
  } else if (err.code === undefined) {
    return {
      message: err.message,
      replace: {},
      allowReport: err["allowReport"],
    };
  } else if (err.syscall === "getaddrinfo") {
    return {
      message:
        'Network address "{{host}}" could not be resolved. This is often a temporary error, ' +
        "please try again later.",
      replace: { host: err.host || err.hostname },
      allowReport: false,
    };
  } else if (err.code === "EPERM") {
    const filePath = err.path || err.filename;
    const firstLine =
      filePath !== undefined
        ? 'Vortex needs to access "{{filePath}}" but it\'s write protected.\n'
        : "Vortex needs to access a file that is write protected.\n";
    return {
      message:
        firstLine +
        "When you configure directories and access rights you need to ensure Vortex can " +
        "still access data directories.\n" +
        "This is usually not a bug in Vortex.",
      replace: { filePath },
      allowReport: false,
    };
  } else if (err.code === "ENOENT") {
    if (err.path !== undefined || err.filename !== undefined) {
      const filePath = err.path || err.filename;

      return {
        message: 'Vortex tried to access "{{filePath}}" but it doesn\'t exist.',
        replace: { filePath },
        allowReport: false,
      };
    } else if (err.host !== undefined) {
      return {
        message: 'Network address "{{host}}" not found.',
        replace: { host: err.host },
        allowReport: false,
      };
    }
  } else if (err.code === "ENOSPC") {
    return {
      message: "The disk is full",
      allowReport: false,
    };
  } else if (err.code === "EACCES" || err.port !== undefined) {
    return {
      message:
        "Network connect was not permitted, please check your firewall settings",
      allowReport: false,
    };
  } else if (err.code === "EPROTO") {
    return {
      message:
        "Network protocol error. This is usually a temporary error, " +
        "please try again later.",
      allowReport: false,
    };
  } else if (err.code === "ENETUNREACH") {
    return {
      message: "Network server not reachable.",
      allowReport: false,
    };
  } else if (err.code === "ECONNABORTED") {
    return {
      message: "Network connection aborted by the server.",
      allowReport: false,
    };
  } else if (err.code === "ECONNREFUSED") {
    return {
      message: "Network connection refused.",
      allowReport: false,
    };
  } else if (err.code === "ECONNRESET") {
    return {
      message: "Network connection closed unexpectedly.",
      allowReport: false,
    };
  } else if (["ETIMEDOUT", "ESOCKETTIMEDOUT"].includes(err.code)) {
    return {
      message:
        'Network connection to "{{address}}" timed out, please try again.',
      replace: { address: err.address },
      allowReport: false,
    };
  } else if (err.message.startsWith("connect ETIMEDOUT")) {
    return {
      message: "Network connection timed out, please try again.",
      replace: { address: err.address },
      allowReport: false,
    };
  } else if (err.code === "EAI_AGAIN") {
    return {
      message: "Temporary name resolution error, please try again later.",
      allowReport: false,
    };
  } else if (err.code === "EISDIR") {
    return {
      message: 'Vortex expected a file but found a directory: "{{path}}".',
      replace: { path: err.path },
      allowReport: false,
    };
  } else if (err.code === "ENOTDIR") {
    return {
      message: "Vortex expected a directory but found a file.",
      allowReport: false,
    };
  } else if (err.code === "EROFS") {
    return {
      message: "The filesystem is read-only.",
      allowReport: false,
    };
  } else if (err.code === "EIO") {
    return {
      message:
        "A general I/O error was reported. This may indicate a hardware defect or a " +
        "removable medium got disconnected, sometimes it may also be caused by the " +
        "disk being almost full.",
      allowReport: false,
    };
  } else if (
    ["ERR_SSL_WRONG_VERSION_NUMBER", "ERR_SSL_BAD_DECRYPT"].includes(
      err.code,
    ) ||
    err.message.startsWith("Hostname/IP does not match certificate's altnames")
  ) {
    return {
      message:
        "A network SSL error occurred. If this problem persists, please update and review " +
        "any network-related security software in your system (Anti Virus, Firewall, " +
        "Proxies, ...)",
      allowReport: false,
    };
  } else if (["CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID"].includes(err.code)) {
    return {
      message:
        "A secure connection could not be established because the server certificate is not valid. In most cases this happens when the date or time on your computer is incorrect. It can also be caused by problems with your internet provider, antivirus software interfering with certificates, or in rare cases by malicious software on your system.",
      allowReport: false,
    };
  } else if (
    [
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "ERR_SSL_WRONG_VERSION_NUMBER",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    ].includes(err.code) ||
    err.function === "OPENSSL_internal"
  ) {
    return {
      message:
        "Encountered an invalid SSL certificate. If this happens on a network connection " +
        "to a server that has a proper certificate (like the Nexus Mods API) it may " +
        "indicate a significant security issue in your system.",
      allowReport: false,
    };
  } else if (["ERR_DLOPEN_FAILED"].includes(err.code)) {
    const lines: string[] = err.message.split(os.EOL);
    if (lines.length === 2) {
      const filePath: string = lines[1];
      return {
        message:
          'The DLL "{{fileName}}" failed to load. This usually happens because an ' +
          "Antivirus tool has incorrectly quarantined or locked it.",
        replace: {
          fileName: path.basename(filePath),
        },
      };
    } else {
      return {
        message:
          "A DLL failed to load. This usually happens because an " +
          "Antivirus tool has incorrectly quarantined or locked it.",
      };
    }
  } else if (err.code === "UNKNOWN") {
    if (truthy(err["nativeCode"])) {
      // the if block is the original code from when native error codes were introduced
      // but nativeCode is supposed to be only the numerical code, not an object with both
      // message and code.
      // To be safe I'm keeping both variants but I'm fairly sure the first block is never hit
      if (err["nativeCode"].code !== undefined) {
        return {
          message:
            "An unrecognized error occurred. The error may contain information " +
            "useful for handling it better in the future so please do report it (once): \n" +
            `${err["nativeCode"].message} (${err["nativeCode"].code})`,

          allowReport: true,
        };
      } else {
        return {
          message:
            "An unrecognized error occurred. The error may contain information " +
            "useful for handling it better in the future so please do report it (once): \n" +
            `${err.message} (${err["nativeCode"]})`,

          allowReport: true,
        };
      }
    } else {
      return {
        message:
          "An unknown error occurred. What this means is that Windows or the framework " +
          "don't provide any useful information to diagnose this problem. " +
          "Please do not report this issue without saying what exactly you were doing.",
      };
    }
  }

  return {
    message: err.message,
    code: err.code,
    stack: err?.stack,
    allowReport: err["allowReport"],
  };
}

const HIDE_ATTRIBUTES = new Set([
  "message",
  "error",
  "context",
  "errno",
  "syscall",
  "isOperational",
  "attachLogOnReport",
  "extensionName",
  "name",
]);

interface ICustomErrorType {
  message?: string;
  text?: string;
  parameters?: any;
  allowReport?: boolean;
  wrap: boolean;
}

function isPrivateField(key: string): boolean {
  // our own private fields all start with a lower case m followed by UpperCamelCase, like
  // mExtraInfo
  return key[0] === "m" && key[1].toUpperCase() === key[1];
}

function renderCustomError(err: any) {
  const res: ICustomErrorType = { wrap: false };
  if (err.error !== undefined && err.error instanceof Error) {
    // there's probably different fields in a custom error that might contain file path
    const fileName = err.executable;
    const pretty = prettifyNodeErrorMessage(err.error, undefined, fileName);
    if (err.message !== undefined) {
      res.text = err.message;
      res.message = pretty.message;
    } else {
      res.text = pretty.message;
    }
    res.parameters = pretty.replace;
    res.allowReport = pretty.allowReport;
  } else {
    res.text = err.message || "An error occurred";
  }

  let attributes = Object.keys(err || {}).filter(
    (key) => key[0].toUpperCase() === key[0],
  );
  if (attributes.length === 0) {
    attributes = Object.keys(err || {}).filter(
      (key) => !isPrivateField(key) && !HIDE_ATTRIBUTES.has(key),
    );
  }
  if (attributes.length > 0) {
    const old = res.message;
    res.message = attributes.map((key) => key + ":\t" + err[key]).join("\n");
    if (old !== undefined) {
      res.message = old + "\n" + res.message;
    }
  }
  if (res.message !== undefined && res.message.length === 0) {
    res.message = undefined;
  }
  return res;
}

function prettifyHTTPError(err: HTTPError): IErrorRendered {
  const fallback = () => {
    const rangeDescription =
      err.statusCode >= 500
        ? "This code is usually the responsibility of the server and will likely be temporary"
        : err.statusCode >= 400
          ? "This code is usually caused by an invalid request, maybe you followed a link " +
            "that has expired or you lack permission to access it."
          : err.statusCode >= 300
            ? "This code indicates the url is no longer valid."
            : "This code isn't an error and shouldn't have been reported";

    return {
      text:
        'Requesting url "{{url}}" failed with status "{{statusCode}} {{message}}".\n' +
        rangeDescription,
      parameters: {
        message: err.statusMessage,
        url: err.url,
        statusCode: err.statusCode,
      },
      // 3xx errors are redirections and should have been followed but sometimes pages
      //  just redirect to themselves
      // 2xx aren't errors and shouldn't have been reported.
      allowReport: err.statusCode < 300,
      wrap: false,
      translated: true,
    };
  };

  const func =
    {
      "429": () => {
        const errorRendered: IErrorRendered = {
          wrap: true,
          message:
            'You have exceeded the daily or hourly rate limit. Visit "help.nexusmods.com" and search for "Rate limit" for more information. Please try again later.',
        };
        return errorRendered;
      },
    }[err.statusCode] || fallback;

  return func();
}

export interface IErrorRendered {
  message?: string;
  text?: string;
  parameters?: any;
  allowReport?: boolean;
  wrap: boolean;
  translated?: boolean;
}

/**
 * render error message for display to the user
 * @param err
 */
export function renderError(
  err: string | Error | any,
  options?: IErrorOptions,
): IErrorRendered {
  if (Array.isArray(err)) {
    err = err[0];
  } else if (err === undefined || err === null) {
    err = new Error("Unknown error");
  }
  if (typeof err === "string") {
    return {
      text: err,
      parameters: options?.replace,
      wrap: true,
    };
  } else if (err instanceof StalledError) {
    return {
      message: "Download stalled",
      text: `Please check your internet connection or, if you are a premium member, try a different preferred download location within your account´s Site Preferences`,
      wrap: false,
      allowReport: false,
    };
  } else if (err?.name === "HTTPError") {
    return prettifyHTTPError(err);
  } else if (err?.code === "invalid_grant") {
    return {
      message: err?.description ?? "Invalid token",
      text: `Your OAuth token has either expired or has been revoked, please log in again to generate a new token.`,
      wrap: false,
      allowReport: false,
    };
  } else if (err instanceof Error) {
    const errMessage = prettifyNodeErrorMessage(err, options);

    const flatErr = flatten(err || {}, { maxLength: 5 });
    delete flatErr["allowReport"];

    let attributes = Object.keys(flatErr || {}).filter(
      (key) => key[0].toUpperCase() === key[0],
    );
    if (attributes.length === 0) {
      attributes = Object.keys(flatErr || {}).filter(
        (key) => !isPrivateField(key) && !HIDE_ATTRIBUTES.has(key),
      );
    }
    if (attributes.length > 0) {
      const old = errMessage.message;
      errMessage.message = attributes
        .map((key) => key + ":\t" + flatErr[key])
        .join("\n");
      if (old !== undefined) {
        errMessage.message = old + "\n" + errMessage.message;
      }
    }

    return {
      text: errMessage.message,
      message: err.stack,
      parameters: errMessage.replace,
      wrap: false,
      allowReport: errMessage.allowReport,
      translated: true,
    };
  } else {
    return renderCustomError(err);
  }
}
