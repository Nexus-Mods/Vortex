import type { ReportableError } from "@vortex/shared/errors";

import nexusApi from "@nexusmods/nexus-api";
import { app, dialog } from "electron";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { v4 as uuidv4 } from "uuid";
import winapi from "winapi-bindings";

import { log } from "./logging";

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

export async function sendReportFile(filePath: string): Promise<void> {
  const contents = await readFile(filePath, "utf8");
  const json = JSON.parse(contents);
  await reportCrash(json.type, json.error, json.context);
}

export async function reportCrash(
  type: string,
  error: ReportableError,
  context?: Record<string, string>,
  attachment?: string,
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    const fullMessage =
      error.title !== undefined
        ? error.message + `\n(${error.title})`
        : error.message;
    dialog.showErrorBox(
      fullMessage,
      JSON.stringify({ type, error, context, attachment }, undefined, 2),
    );
    return;
  }

  try {
    const hash = hashError(error);

    const nexus = await nexusApi.createWithOAuth(
      undefined,
      {
        id: "vortex_loopback",
      },
      "Vortex",
      app.getVersion(),
      undefined,
    );

    const referenceId = uuidv4();

    const res = await nexus.sendFeedback(
      createFeedbackTitle(type, error),
      createFeedbackMessage(type, error, context || {}, app.getVersion()),
      attachment,
      true,
      hash,
      referenceId,
    );

    // TODO: open crash report
  } catch (err) {
    log("error", "failed to report error to nexus", err);
  }
}

function createFeedbackTitle(type: string, error: ReportableError): string {
  return `${type}: ${error.message}`;
}

function createFeedbackMessage(
  type: string,
  error: ReportableError,
  context: Record<string, string>,
  appVersion: string,
): string {
  const sections = [
    `#### System
| | |
|------------ | -------------|
|Platform | ${process.platform} ${os.release()} ${isWine() ? "(Wine)" : ""} |
|CPU Architecture | ${getCPUArch()} |
|Architecture | ${process.arch} |
|Application Version | ${appVersion} |
|Process | ${error.process || "unknown"} |`,
    `#### Message
${error.message}`,
  ];

  if (error.title) {
    sections.push(`#### Title
\`\`\`
${error.title}
\`\`\`
`);
  }

  if (error.details) {
    sections.push(`#### Details
\`\`\`
${error.details}
\`\`\``);
  }

  if (Object.keys(context).length > 0) {
    sections.push(`#### Context
\`\`\`
${Object.keys(context)
  .map((key) => `${key} = ${context[key]}`)
  .join("\n")}
\`\`\``);
  }

  if (error.path) {
    sections.push(`#### Path
\`\`\`
${error.path}
\`\`\``);
  }

  if (error.stack) {
    sections.push(`#### Stack
\`\`\`
${error.stack}
\`\`\``);
  }

  return `### Application ${type}\n` + sections.join("\n");
}

function isWine() {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    return winapi.IsThisWine();
  } catch {
    return false;
  }
}

function getCPUArch() {
  try {
    const nativeArchInfo = winapi.GetNativeArch();
    return nativeArchInfo.nativeArch;
  } catch {
    return os.arch();
  }
}

function hashError(error: ReportableError): string {
  const hash = createHash("md5");
  return hash.update(extractToken(error)).digest("hex");
}

// remove the file names from stack lines because they contain local paths
function removeFileNames(input: string): string {
  return input
    .replace(/(at [^\(]*)\(.*\)$/, "$1")
    .replace(/at [A-Z]:\\.*\\([^\\]*)/, "at $1");
}

// remove everything in quotes to get file names and such out of the error message
function removeQuoted(input: string): string {
  return input
    .replace(/'.*?'($|\s|\.|\,|\;)/g, "")
    .replace(/"[^"]*"/g, "")
    .replace(/'[^']*'/g, "");
}

// sanitize certain well known error messages that don't get properly stripped by removing quotes
// or contain localized components
function sanitizeKnownMessages(input: string): string {
  return (
    input
      .replace(/(Unexpected token ). (in JSON at position) [0-9]+/, "$1$2 ...")
      // reported from loot, the rest of these errors is localized
      .replace(/(boost::filesystem::file_size:) .*/, "$1")
      .replace(/.*(contains invalid WIN32 path characters.)/, "... $1")
      .replace(
        /(Error: Cannot get property '[^']*' on missing remote object) [0-9]+/,
        "$1",
      )
      .replace(/.*(Cipher functions:OPENSSL_internal).*/, "$1")
      .replace(/\\\\?\\.*(\\Vortex\\resources)/i, "$1")
  );
}

// remove stack lines that are known to contain information that doesn't distinguish the issue
// but tends to be variable
function removeKnownVariable(input: string): string {
  return input
    .replace(/HResult: [0-9\-]*/, "")
    .replace(/[0-9]+:error:[0-9a-f]+:(SSL routines:OPENSSL_internal):.*/, "$1");
}

// replace "at foobar [as somename]" by "at somename"
// TODO: This is mostly necessary because source maps are tranlated incorrectly and in these cases,
//   "foobar part" seems to be almost random and non-sensical wheras the "somename part" is mostly
//   correct
function replaceFuncName(input: string): string {
  return input.replace(/at [^ ]* \[as (.*?)\]/, "at $1");
}

// this attempts to remove everything "dynamic" about the error message so that
// the hash is only calculated on the static part so we can group them
function sanitizeStackLine(input: string): string {
  return replaceFuncName(
    removeKnownVariable(removeQuoted(removeFileNames(input))),
  );
}

function extractToken(error: ReportableError): string {
  if (error.stack === undefined) {
    return removeQuoted(error.message);
  }

  let hashStack = error.stack.split("\n");

  let messageLineCount = hashStack.findIndex((line) => line.startsWith(" "));
  if (messageLineCount === -1) {
    messageLineCount = 1;
  }

  hashStack = [
    removeQuoted(
      sanitizeKnownMessages(hashStack.slice(0, messageLineCount).join(" ")),
    ),
    ...hashStack.slice(messageLineCount).map(sanitizeStackLine),
  ];

  const idx = hashStack.findIndex(
    (line) =>
      line.indexOf("Promise._settlePromiseFromHandler") !== -1 ||
      line.indexOf("MappingPromiseArray._promiseFulfilled") !== -1,
  );
  if (idx !== -1) {
    hashStack.splice(idx);
  }

  return hashStack.join("\n");
}
