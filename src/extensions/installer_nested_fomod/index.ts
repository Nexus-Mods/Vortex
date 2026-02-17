/**
 * installer for fomods packaged inside another archive.
 * All this does is request the nested file, then delegate the installation
 * to another installer.
 */

import PromiseBB from "bluebird";
import * as path from "path";
import type {
  IExtensionApi,
  IExtensionContext,
  ISupportedResult,
  ProgressDelegate,
} from "../../renderer/types/IExtensionContext";
import { log } from "../../renderer/util/log";

function testSupported(files: string[]): PromiseBB<ISupportedResult> {
  return new PromiseBB((resolve, reject) => {
    const fomod = files.find((file) => path.extname(file) === ".fomod");
    if (fomod !== undefined) {
      resolve({ supported: true, requiredFiles: [fomod] });
    } else {
      resolve({ supported: false, requiredFiles: [] });
    }
  });
}

function install(
  api: IExtensionApi,
  files: string[],
  destinationPath: string,
  gameId: string,
  choicesIn: any,
  unattended: boolean,
  progress: ProgressDelegate,
): PromiseBB<any> {
  return new PromiseBB((resolve, reject) => {
    const fomod = files.find((file) => path.extname(file) === ".fomod");
    const filePath = path.join(destinationPath, fomod);
    log("debug", "install nested", filePath);
    resolve({
      instructions: [
        {
          type: "submodule",
          key: fomod,
          path: filePath,
          choices: choicesIn,
          unattended,
        },
      ],
    });
  });
}

function init(context: IExtensionContext): boolean {
  context.registerInstaller(
    "nested_fomod",
    0,
    testSupported,
    (
      files: string[],
      destinationPath: string,
      gameId: string,
      progress: ProgressDelegate,
      choicesIn?: any,
      unattended?: boolean,
    ) =>
      install(
        context.api,
        files,
        destinationPath,
        gameId,
        choicesIn,
        unattended,
        progress,
      ),
  );
  return true;
}

export default init;
