import type { ProgressDelegate } from "../types/InstallFunc";
import type { ISupportedResult } from "../types/TestSupported";

import PromiseBB from "bluebird";
import * as path from "path";

export function testSupported(files: string[]): PromiseBB<ISupportedResult> {
  const result: ISupportedResult = { supported: true, requiredFiles: [] };
  return PromiseBB.resolve(result);
}

export function install(
  files: string[],
  destinationPath: string,
  gameId: string,
  progress: ProgressDelegate,
): PromiseBB<any> {
  return PromiseBB.resolve({
    message: "Success",
    instructions: files
      .filter((name: string) => !name.endsWith(path.sep))
      .map((name: string) => ({
        type: "copy",
        source: name,
        destination: name,
      })),
  });
}
