import * as path from "path";

import { fs, log } from "@nexusmods/vortex-api";
import PromiseBB from "bluebird";

import type { ISettingsFile } from "./gameSupport";

export function copyGameSettings(
  sourcePath: string,
  destinationPath: string,
  files: ISettingsFile[],
  copyType: string,
): PromiseBB<void> {
  return PromiseBB.map(files, (gameSetting) => {
    const originalSource = path.join(sourcePath, gameSetting.name);
    let source = originalSource;
    let destination = path.join(destinationPath, path.basename(gameSetting.name));
    const destinationOrig = destination;

    if (copyType.startsWith("Glo")) {
      source += ".base";
    } else if (copyType.endsWith("Glo")) {
      destination += ".base";
    }

    log("debug", "copying profile inis", { source, destination });

    const copySource = () =>
      fs.copyAsync(source, destination, { noSelfCopy: true }).catch({ code: "ENOENT" }, (err) => {
        if (copyType.startsWith("Glo") && source !== originalSource) {
          source = originalSource;
          return fs.copyAsync(source, destination, { noSelfCopy: true });
        }
        return PromiseBB.reject(err);
      });

    return copySource()
      .catch((err) => {
        if (gameSetting.optional) {
          return PromiseBB.resolve();
        }
        switch (copyType) {
          // backup missing, create it now from global file
          case "BacGlo":
            return fs.copyAsync(destination, source, { noSelfCopy: true });
          // profile ini missing, create it now from global file
          case "ProGlo":
            return fs.copyAsync(destination, source, { noSelfCopy: true });
          // fatal error
          default:
            return PromiseBB.reject(err);
        }
      })
      .then(() =>
        copyType.endsWith("Glo")
          ? fs
              .copyAsync(source, destinationOrig, { noSelfCopy: true })
              .then(() =>
                fs.copyAsync(source, destinationOrig + ".baked", {
                  noSelfCopy: true,
                }),
              )
              .catch({ code: "ENOENT" }, (err) =>
                gameSetting.optional ? PromiseBB.resolve() : PromiseBB.reject(err),
              )
          : PromiseBB.resolve(),
      );
  }).then(() => undefined);
}
