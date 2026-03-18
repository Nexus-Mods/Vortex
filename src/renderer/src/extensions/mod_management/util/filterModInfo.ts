import {
  getErrorMessageOrDefault,
  unknownToError,
} from "@vortex/shared";

import type { AttributeExtractor } from "../../../types/IExtensionContext";

import { log } from "../../../util/log";

const attributeExtractors: Array<{
  priority: number;
  extractor: AttributeExtractor;
}> = [];

export function registerAttributeExtractor(
  priority: number,
  extractor: AttributeExtractor,
) {
  attributeExtractors.push({ priority, extractor });
  attributeExtractors.sort((lhs, rhs) => rhs.priority - lhs.priority);
}

/**
 * Debug function to list all registered attribute extractors
 * Useful for identifying which extractors are registered and their priorities
 */
export function debugListExtractors(): Array<{
  priority: number;
  name: string;
  details: string;
}> {
  return attributeExtractors.map(({ priority, extractor }) => {
    let name = "[unknown extractor]";
    let details = "";
    try {
      const extractorObj = extractor as any;
      if (extractorObj.name && extractorObj.name !== "Function") {
        name = extractorObj.name;
      } else if (typeof extractor === "function") {
        const funcStr = extractor.toString();
        const match = funcStr.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (match && match[1] !== "Function") {
          name = match[1];
        } else {
          const bodyMatch = funcStr.match(/return\s+({[^}]*}|[^;]+)/);
          if (bodyMatch) {
            name = `[anonymous: ${bodyMatch[1].substring(0, 30)}...]`;
          } else {
            name = "[anonymous function extractor]";
          }
        }
      }
      details = `type: ${typeof extractor}, hasName: ${!!extractorObj.name}, constructor: ${extractorObj.constructor?.name || "unknown"}`;
    } catch (err) {
      name = "[identification failed]";
      details = `error: ${getErrorMessageOrDefault(err)}`;
    }
    return { priority, name, details };
  });
}

function filterNullish(input: { [key: string]: any }) {
  return Object.fromEntries(
    Object.entries(input ?? {}).filter(([_, val]) => val != null),
  );
}

// Every mod installation is run through the attributeExtractors in order of priority.
//  Imagine the simplest use case where installing a collection with 1000 mods - and one extractor takes over 1.5 seconds to run,
//  that's at a minimum 25 minutes of waiting for the user. Keep in mind that incorrect usage of the attributeExtractors in community
//  extensions will raise this time even further. This is why we have a timeout of 5 seconds for each extractor (this is already quite generous).
// All core extractors should never take more than a few milliseconds to run.
function extractorOrSkip(
  extractor: AttributeExtractor,
  input: any,
  modPath: string,
): Promise<any> {
  // Enhanced extractor identification for better debugging
  let extractorName = "[unknown extractor]";
  let extractorDetails = "";

  try {
    const extractorObj = extractor as any;

    if (extractorObj.name && extractorObj.name !== "Function") {
      extractorName = extractorObj.name;
    } else if (typeof extractor === "function") {
      const funcStr = extractor.toString();
      const match = funcStr.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (match && match[1] !== "Function") {
        extractorName = match[1];
      } else {
        const bodyMatch = funcStr.match(/return\s+({[^}]*}|[^;]+)/);
        if (bodyMatch) {
          extractorName = `[anonymous: ${bodyMatch[1].substring(0, 50)}...]`;
        } else {
          extractorName = "[anonymous function extractor]";
        }
      }
    }
    extractorDetails = ` (type: ${typeof extractor}, hasName: ${!!extractorObj.name}, constructor: ${extractorObj.constructor?.name || "unknown"})`;
  } catch (err) {
    extractorName = "[extractor identification failed]";
    extractorDetails = ` (error: ${getErrorMessageOrDefault(err)})`;
  }

  // Create timeout promise that rejects after 5 seconds
  // const timeoutPromise = new Promise<any>((_, reject) => {
  //   setTimeout(() => {
  //     reject(new Error(`Extractor "${extractorName}" timed out after 5 seconds${extractorDetails}`));
  //   }, 5000);
  // });

  // Add start time for performance tracking
  const startTime = Date.now();

  // Race the extractor against the timeout
  return Promise.resolve(extractor(input, modPath)).catch((unknownError) => {
    const duration = Date.now() - startTime;

    const err = unknownToError(unknownError);
    log(
      "error",
      `Extractor skipped: "${extractorName}" (modPath: "${modPath}") - ${err.message}`,
      {
        extractorName,
        duration,
        modPath,
        extractorDetails,
        errorType: err.name || "Unknown",
      },
    );
    return {};
  });
}

function filterModInfo(input: any, modPath: string): Promise<any> {
  return Promise.all(
    attributeExtractors.map((extractor) =>
      extractorOrSkip(extractor.extractor, input, modPath),
    ),
  ).then((infoBlobs) => Object.assign({}, ...infoBlobs.map(filterNullish)));
}

export default filterModInfo;
