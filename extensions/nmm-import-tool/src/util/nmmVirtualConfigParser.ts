import { IFileEntry, IModEntry, ParseError } from "../types/nmmEntries";

import Promise from "bluebird";
import * as modmeta from "modmeta-db";
import * as path from "path";
import { fs, log, types, util } from "vortex-api";

interface IModMap {
  [modId: string]: types.IMod;
}

function getModInfoList(xmlData: string): Promise<HTMLCollectionOf<Element>> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "text/xml");
    const version = xmlDoc.getElementsByTagName("virtualModActivator")[0];

    // sanity checks for the file structure
    if (version === null || version === undefined) {
      return reject(
        new ParseError(
          "The selected folder does not contain a valid VirtualModConfig.xml file.",
        ),
      );
    }

    if (version.getAttribute("fileVersion") !== "0.3.0.0") {
      return reject(
        new ParseError(
          "The selected folder contains an older VirtualModConfig.xml file," +
            "you need to upgrade your NMM before proceeding with the mod import.",
        ),
      );
    }

    return resolve(xmlDoc.getElementsByTagName("modInfo"));
  });
}

export function isConfigEmpty(configFilePath: string): Promise<boolean> {
  return fs
    .readFileAsync(configFilePath)
    .then((data) => getModInfoList(data.toString("utf-8")))
    .then((modInfoList) => {
      return modInfoList === undefined || modInfoList.length === 0
        ? Promise.resolve(true)
        : Promise.resolve(false);
    })
    .catch((err) => Promise.resolve(true));
}

export function parseNMMConfigFile(
  nmmFilePath: string,
  mods: IModMap,
): Promise<IModEntry[]> {
  return fs
    .readFileAsync(nmmFilePath)
    .then((data) =>
      parseModEntries(data.toString("utf-8"), mods).then((modEntries) =>
        modEntries.filter((entry) => entry !== undefined),
      ),
    )
    .catch((err) =>
      Promise.reject(
        new ParseError(
          "The selected folder does not contain a VirtualModConfig.xml file.",
        ),
      ),
    );
}

// exported so it can be unit-tested (ugh)
export function parseModEntries(
  xmlData: string,
  mods: IModMap,
): Promise<IModEntry[]> {
  // lookup to determine if a mod is already installed in vortex
  const modListSet = new Set(
    Object.keys(mods || {}).map((key: string) => mods[key].id),
  );

  return getModInfoList(xmlData).then((modInfoList) => {
    if (modInfoList === undefined || modInfoList.length <= 0) {
      return Promise.reject(
        new ParseError(
          "The selected folder contains an empty VirtualModConfig.xml file.",
        ),
      );
    }

    return Promise.map(
      Array.from(modInfoList),
      (modInfo: Element): Promise<IModEntry> => {
        const res: IModEntry = {
          nexusId: modInfo.getAttribute("modId"),
          vortexId: undefined,
          downloadId:
            parseInt(modInfo.getAttribute("downloadId"), 10) || undefined,
          modName: modInfo.getAttribute("modName"),
          modFilename: modInfo.getAttribute("modFileName"),
          archivePath: modInfo.getAttribute("modFilePath"),
          modVersion: modInfo.getAttribute("FileVersion"),
          importFlag: true,
          archiveMD5: null,
          isAlreadyManaged: false,
        };

        const archiveName = path.basename(
          res.modFilename,
          path.extname(res.modFilename),
        );
        res.vortexId = util.deriveInstallName(archiveName, {});
        res.isAlreadyManaged = modListSet.has(res.vortexId);

        const modArchiveFilePath = path.join(res.archivePath, res.modFilename);
        return fs
          .statAsync(modArchiveFilePath)
          .then(() => modmeta.genHash(modArchiveFilePath))
          .then((hashResult: modmeta.IHashResult) => {
            res.archiveMD5 = hashResult.md5sum;
            return Promise.resolve(res);
          })
          .catch(() => Promise.resolve(undefined));
      },
    );
  });
}

export default parseNMMConfigFile;
