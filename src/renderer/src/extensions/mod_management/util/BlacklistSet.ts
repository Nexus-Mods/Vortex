import * as path from "node:path";

import { getErrorMessageOrDefault } from "@vortex/shared";
import minimatch from "minimatch";

import { log } from "../../../logging";
import type { IGame } from "../../../types/IGame";
import type { Normalize } from "../../../util/getNormalizeFunc";
import { DEPLOY_BLACKLIST } from "../constants";
import type { IMod } from "../types/IMod";

/** Relative paths as the entries activate() skips: `<installationPath>/<relPath>`. */
export function skipListEntries(
  installationPath: string,
  relPaths: string[],
  normalize: Normalize,
): string[] {
  return relPaths.map((relPath) => normalize(path.join(installationPath, relPath)));
}

/** A mod's file overrides, stored as absolute paths in the destination, as skip list entries. */
export function fileOverrideEntries(
  mod: IMod,
  destinationPath: string,
  normalize: Normalize,
): string[] {
  const relPaths = (mod.fileOverrides ?? []).map((file) => path.relative(destinationPath, file));
  return skipListEntries(mod.installationPath, relPaths, normalize);
}

export default class BlacklistSet extends Set<string> {
  private mPatterns: minimatch.IMinimatch[];
  constructor(blacklist: string[], game: IGame, normalize: Normalize) {
    super(blacklist.filter((x) => !!x).map((iter) => normalize(iter)));
    const patterns = DEPLOY_BLACKLIST.concat(game.details?.ignoreDeploy ?? []);
    this.mPatterns = patterns
      .filter((x) => !!x)
      .flatMap((pattern) => {
        try {
          return [new minimatch.Minimatch(normalize(pattern), { nocase: true, dot: true })];
        } catch (err: unknown) {
          log("warn", "ignoring an unusable deployment skip pattern", {
            pattern,
            error: getErrorMessageOrDefault(err),
          });
          return [];
        }
      });
  }

  public has(value: string): boolean {
    if (!value) {
      return false;
    }
    return super.has(value) || this.mPatterns.some((pattern) => pattern.match(value));
  }
}
