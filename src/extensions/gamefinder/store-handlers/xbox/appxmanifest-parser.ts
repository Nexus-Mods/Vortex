/**
 * Parser for appxmanifest.xml files
 * These files contain metadata about UWP/Xbox apps including display name and identity
 */

import { readFileSync } from "fs";
import { XMLParser } from "fast-xml-parser";
import { Result, ok, err } from "neverthrow";
import type { GameFinderError } from "../../common";

/**
 * Represents the parsed appxmanifest.xml structure
 */
interface AppxManifest {
  Package: {
    Identity: {
      "@_Name": string;
    };
    Properties: {
      DisplayName: string;
    };
  };
}

/**
 * Parsed app information from appxmanifest.xml
 */
export interface AppxManifestInfo {
  /** The identity name from the manifest */
  identityName: string;
  /** The display name shown to users */
  displayName: string;
}

/**
 * Parse an appxmanifest.xml file to extract app information
 */
export function parseAppxManifest(
  filePath: string,
): Result<AppxManifestInfo, GameFinderError> {
  try {
    const xmlContent = readFileSync(filePath, "utf-8");

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      ignoreDeclaration: true,
      parseAttributeValue: false,
      trimValues: true,
    });

    const parsed = parser.parse(xmlContent) as AppxManifest;

    if (!parsed.Package) {
      return err({
        code: "XBOX_MANIFEST_INVALID",
        message: `Invalid appxmanifest.xml: missing Package element in ${filePath}`,
      });
    }

    if (!parsed.Package.Identity || !parsed.Package.Identity["@_Name"]) {
      return err({
        code: "XBOX_MANIFEST_INVALID",
        message: `Invalid appxmanifest.xml: missing Identity.Name in ${filePath}`,
      });
    }

    if (!parsed.Package.Properties || !parsed.Package.Properties.DisplayName) {
      return err({
        code: "XBOX_MANIFEST_INVALID",
        message: `Invalid appxmanifest.xml: missing Properties.DisplayName in ${filePath}`,
      });
    }

    return ok({
      identityName: parsed.Package.Identity["@_Name"],
      displayName: parsed.Package.Properties.DisplayName,
    });
  } catch (error) {
    return err({
      code: "XBOX_MANIFEST_ERROR",
      message: `Failed to parse appxmanifest.xml: ${filePath}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
