import { fileMD5 } from "../../renderer/util/checksum";
import * as fs from "../../renderer/util/fs";
import type { IInstruction } from "./types/IInstallResult";
import type { IFileListItem } from "./types/IMod";
import type { ISupportedInstaller } from "./types/IModInstaller";
import type { ProgressDelegate } from "./types/InstallFunc";
import type { ISupportedResult } from "./types/TestSupported";

import PromiseBB from "bluebird";
import * as path from "path";
import { XXHash64 } from "xxhash-addon";

function testSupported(): PromiseBB<ISupportedResult> {
  return PromiseBB.resolve({
    supported: true,
    requiredFiles: [],
  });
}

function makeXXHash64() {
  return (filePath: string): PromiseBB<string> => {
    return fs.readFileAsync(filePath).then((data) => {
      const buf: Buffer = XXHash64.hash(data);
      return buf.toString("base64");
    });
  };
}

/**
 * installer designed to unpack a specific list of files
 * from an archive, ignoring any install script
 */
function makeListInstaller(
  extractList: IFileListItem[],
  basePath: string,
): PromiseBB<ISupportedInstaller> {
  let lookupFunc: (filePath: string) => PromiseBB<string> = (
    filePath: string,
  ) => PromiseBB.resolve(fileMD5(filePath));

  let idxId = "md5";

  // TODO: this is awkward. We expect the entire list to use the same checksum algorithm
  if (
    extractList.find(
      (iter) => iter.md5 !== undefined || iter.xxh64 === undefined,
    ) === undefined
  ) {
    lookupFunc = makeXXHash64();
    idxId = "xxh64";
  }

  return PromiseBB.resolve({
    installer: {
      id: "list-installer",
      priority: 0,
      testSupported,
      install: (
        files: string[],
        destinationPath: string,
        gameId: string,
        progressDelegate: ProgressDelegate,
      ) => {
        let prog = 0;
        // build lookup table of the existing files on disk md5 -> source path
        return PromiseBB.reduce(
          files.filter((relPath) => !relPath.endsWith(path.sep)),
          (prev, relPath, idx, length) => {
            return lookupFunc(path.join(basePath, relPath)).then((checksum) => {
              if (Math.floor((idx * 10) / length) > prog) {
                prog = Math.floor((idx * 10) / length);
                progressDelegate(prog * 10);
              }
              prev[checksum] = relPath;
              return prev;
            });
          },
          {},
        ).then((lookup) => {
          // for each item in the extract list, look up the source path vial
          // the lookup table, then create the copy instruction.
          const missingItems: IFileListItem[] = [];
          return {
            instructions: extractList.map((item) => {
              let instruction: IInstruction;
              if (lookup[item[idxId]] === undefined) {
                missingItems.push(item);
                instruction = {
                  type: "error",
                  source: `${item.path} (checksum: ${item[idxId]}) missing`,
                  value: "warn",
                };
              } else {
                instruction = {
                  type: "copy",
                  source: lookup[item[idxId]],
                  destination: item.path,
                };
              }
              return instruction;
            }),
          };
        });
      },
    },
    requiredFiles: [],
  });
}

export default makeListInstaller;
