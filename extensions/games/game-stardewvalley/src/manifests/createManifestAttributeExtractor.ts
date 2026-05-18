import { getErrorMessageOrDefault } from "@vortex/shared";
/**
 * Creates the manifest-based mod attribute extractor used during installation.
 */
import * as semver from "semver";
import { log, selectors } from "vortex-api";
import type { types } from "vortex-api";

import { GAME_ID, SMAPI_MOD_ID } from "../common";
import { getModManifests } from "./getModManifests";
import { parseManifest } from "./parseManifest";

/**
 * Factory for the Stardew Valley manifest attribute extractor.
 *
 * The extractor runs for installed archives and enriches mod attributes with
 * data derived from parsed `manifest.json` files, including:
 * - `additionalLogicalFileNames`
 * - `minSMAPIVersion`
 * - `customFileName` (except for SMAPI itself)
 * - `manifestVersion`
 */
export function createManifestAttributeExtractor(context: types.IExtensionContext) {
  return async (modInfo: any, modPath: string): Promise<{ [key: string]: any }> => {
    if (selectors.activeGameId(context.api.getState()) !== GAME_ID || modPath === undefined) {
      return {};
    }

    const manifests = await getModManifests(modPath);

    const parsedManifests = (
      await Promise.all(
        manifests.map(async (manifest) => {
          try {
            return await parseManifest(manifest);
          } catch (err) {
            log("warn", "Failed to parse manifest", {
              manifestFile: manifest,
              error: getErrorMessageOrDefault(err),
            });
            return undefined;
          }
        }),
      )
    ).filter((manifest) => manifest !== undefined);

    if (parsedManifests.length === 0) {
      return {};
    }

    const refManifest = parsedManifests[0];

    const additionalLogicalFileNames = parsedManifests
      .filter((manifest) => manifest.UniqueID !== undefined)
      .map((manifest) => manifest.UniqueID.toLowerCase());

    const minSMAPIVersion = parsedManifests
      .map((manifest) => manifest.MinimumApiVersion)
      .filter((version) => semver.valid(version))
      .sort((lhs, rhs) => semver.compare(rhs, lhs))[0];

    const result = {
      additionalLogicalFileNames,
      minSMAPIVersion,
    };

    if (refManifest !== undefined) {
      if (modInfo.download.modInfo?.nexus?.ids?.modId !== SMAPI_MOD_ID) {
        result["customFileName"] = refManifest.Name;
      }

      if (typeof refManifest.Version === "string") {
        result["manifestVersion"] = refManifest.Version;
      }
    }

    return result;
  };
}
