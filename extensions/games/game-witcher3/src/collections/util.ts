/** eslint-disable */
import path from "path";

import { fs, log, util } from "@nexusmods/vortex-api";
import { generate } from "shortid";
import turbowalk, { IEntry } from "turbowalk";

import { genCollectionLoadOrder, isModInCollection, isValidMod } from "../collectionLoadOrder";
import { getW3TempDataDir } from "../common";

export { genCollectionLoadOrder, isModInCollection, isValidMod };

export class CollectionGenerateError extends Error {
  constructor(why: string) {
    super(`Failed to generate game specific data for collection: ${why}`);
    this.name = "CollectionGenerateError";
  }
}

export class CollectionParseError extends Error {
  constructor(collectionName: string, why: string) {
    super(`Failed to parse game specific data for collection ${collectionName}: ${why}`);
    this.name = "CollectionGenerateError";
  }
}

export async function walkDirPath(dirPath: string): Promise<IEntry[]> {
  let fileEntries: IEntry[] = [];
  await turbowalk(dirPath, (entries: IEntry[]) => {
    fileEntries = fileEntries.concat(entries);
  })
    .catch({ systemCode: 3 }, () => Promise.resolve())
    .catch((err) =>
      ["ENOTFOUND", "ENOENT"].includes(err.code) ? Promise.resolve() : Promise.reject(err),
    );

  return fileEntries;
}

export async function prepareFileData(dirPath: string): Promise<Buffer> {
  const sevenZip = new util.SevenZip();
  try {
    await fs.ensureDirWritableAsync(getW3TempDataDir());
    const archivePath = path.join(getW3TempDataDir(), generate() + ".zip");
    const entries: string[] = await fs.readdirAsync(dirPath);
    await sevenZip.add(
      archivePath,
      entries.map((entry) => path.join(dirPath, entry)),
      { raw: ["-r"] },
    );

    const data = await fs.readFileAsync(archivePath);
    await fs.removeAsync(archivePath);
    return data;
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function cleanUpEntries(fileEntries: IEntry[]) {
  try {
    fileEntries.sort((lhs, rhs) => rhs.filePath.length - lhs.filePath.length);
    for (const entry of fileEntries) {
      await fs.removeAsync(entry.filePath);
    }
  } catch (err) {
    log("error", "file entry cleanup failed", err);
  }
}

export async function restoreFileData(fileData: Buffer, destination: string): Promise<void> {
  const sevenZip = new util.SevenZip();
  let archivePath;
  let fileEntries: IEntry[] = [];
  try {
    await fs.ensureDirWritableAsync(getW3TempDataDir());
    archivePath = path.join(getW3TempDataDir(), generate() + ".zip");
    await fs.writeFileAsync(archivePath, fileData);
    const targetDirPath = path.join(getW3TempDataDir(), path.basename(archivePath, ".zip"));
    await sevenZip.extractFull(archivePath, targetDirPath);
    fileEntries = await walkDirPath(targetDirPath);
    for (const entry of fileEntries) {
      const relPath = path.relative(targetDirPath, entry.filePath);
      const dest = path.join(destination, relPath);
      await fs.ensureDirWritableAsync(path.dirname(dest));
      await fs.copyAsync(entry.filePath, dest);
    }
    cleanUpEntries(fileEntries);
    return Promise.resolve();
  } catch (err) {
    cleanUpEntries(fileEntries);
    return Promise.reject(err);
  }
}

export function hex2Buffer(hexData: string) {
  const byteArray = new Uint8Array(hexData.length / 2);
  for (let x = 0; x < byteArray.length; x++) {
    byteArray[x] = parseInt(hexData.substr(x * 2, 2), 16);
  }

  const buffer = Buffer.from(byteArray);
  return buffer;
}
