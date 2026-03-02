import { getErrorMessageOrDefault } from "@vortex/shared";
import fs from "fs-extra";
import * as crypto from "node:crypto";
import * as path from "node:path";

import { log } from "./logging";

async function readHashList(
  basePath: string,
): Promise<{ [name: string]: string }> {
  const data = await fs.readFile(path.join(basePath, "md5sums.csv"), {
    encoding: "utf-8",
  });
  return data.split("\n").reduce((prev, line) => {
    const [key, hash] = line.split(":");
    prev[key] = hash;
    return prev;
  }, {});
}

async function hashFile(fullPath: string): Promise<string> {
  const hash = crypto.createHash("md5");
  const fileData: Buffer = await fs.readFile(fullPath);
  const buf = hash.update(fileData).digest();
  return buf.toString("hex");
}

export async function validateFiles(
  basePath: string,
): Promise<{ missing: string[]; changed: string[] }> {
  let fileList = {};
  try {
    fileList = await readHashList(basePath);
  } catch (err) {
    // nop
    log("info", "not validating vortex files", err);
    return { missing: [], changed: [] };
  }

  const result: {
    missing: string[];
    changed: string[];
  } = { missing: [], changed: [] };

  log("info", "start file validation");

  const exePath = path.dirname(process.execPath);

  return Promise.all(
    Object.keys(fileList).map(async (fileName) => {
      try {
        const hash = await hashFile(path.join(exePath, fileName));
        if (hash !== fileList[fileName]) {
          log("info", "file manipulated", {
            fileName,
            hash,
            expected: fileList[fileName],
          });
          result.changed.push(fileName);
        }
      } catch (err) {
        log("info", "file missing", {
          fileName,
          error: getErrorMessageOrDefault(err),
        });
        result.missing.push(fileName);
      }
    }),
  ).then(() => {
    log("info", "done file validation");
    return result;
  });
}
