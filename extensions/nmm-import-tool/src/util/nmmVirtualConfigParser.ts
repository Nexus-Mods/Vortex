import { IFileEntry, IModEntry, ParseError } from '../types/nmmEntries';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as modmetaT from 'modmeta-db';
import * as path from 'path';
import { log, types, util } from 'vortex-api';
const modmeta = util.lazyRequire<typeof modmetaT>('modmeta-db');

interface IModMap {
  [modId: string]: types.IMod;
}

export function parseNMMConfigFile(nmmFilePath: string, mods: IModMap): Promise<any> {
  return fs.readFileAsync(nmmFilePath)
      .catch(
          err => Promise.reject(new ParseError(
              'The selected folder does not contain a VirtualModConfig.xml file.')))
      .then(data => parseModEntries(data.toString('utf-8'), mods, path.dirname(nmmFilePath)));
}

function getInner(ele: Element, tagName: string): string {
  return ele.getElementsByTagName(tagName)[0].childNodes[0].nodeValue;
}

function transformFileEntry(
    fileLink: Element, adjustRealPath: (input: string) => string): IFileEntry {
  const virtualPath = fileLink.getAttribute('virtualPath');
  if ((virtualPath === null) || (virtualPath === undefined)) {
    return undefined;
  }

  return {
    fileSource: adjustRealPath(fileLink.getAttribute('realPath')),
    fileDestination: virtualPath,
    isActive: getInner(fileLink, 'isActive').toLowerCase() === 'true',
    filePriority: parseInt(getInner(fileLink, 'linkPriority'), 10),
  };
}

export function parseModEntries(
    xmlData: string, mods: IModMap,
    virtualInstallPath: string): Promise<IModEntry[]> {
  const nmmModList: IModEntry[] = [];
  const parser = new DOMParser();

  // lookup to determine if a mod is already installed in vortex
  const modListSet = new Set(Object.keys(mods || {}).map((key: string) => mods[key].id));

  const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
  const version = xmlDoc.getElementsByTagName('virtualModActivator')[0];

  // sanity checks for the file structure
  if ((version === null) || (version === undefined)) {
    return Promise.reject(new ParseError(
        'The selected folder does not contain a valid VirtualModConfig.xml file.'));
  }

  if (version.getAttribute('fileVersion') !== '0.3.0.0') {
    return Promise.reject(new ParseError(
        'The selected folder contains an older VirtualModConfig.xml file,' +
        'you need to upgrade your NMM before proceeding with the mod import.'));
  }

  const modInfoList = xmlDoc.getElementsByTagName('modInfo');
  if ((modInfoList === undefined) || (modInfoList.length <= 0)) {
    return Promise.reject(new ParseError(
        'The selected folder contains an empty VirtualModConfig.xml file.'));
  }

  return Promise.map(Array.from(modInfoList), modInfo => {
    const res: any = {
      nexusId: modInfo.getAttribute('modId'),
      downloadId: parseInt(modInfo.getAttribute('downloadId'), 10),
      modName: modInfo.getAttribute('modName'),
      modFilename: modInfo.getAttribute('modFileName'),
      archivePath: modInfo.getAttribute('modFilePath'),
      modVersion: modInfo.getAttribute('FileVersion'),
      importFlag: true,
    };

    const archiveName =
        path.basename(res.modFilename, path.extname(res.modFilename));
    res.vortexId = util.deriveInstallName(archiveName, {});
    res.isAlreadyManaged = modListSet.has(res.vortexId);

    let useOldPath: boolean = false;

    // NMM has a crazy workaround where it will use an install path based on
    // the download id or the archive name, whatever is available
    const adjustRealPath = (input: string): string => {
      return path.join(useOldPath ? archiveName : res.downloadId,
                       ...input.split(path.sep).slice(1));
    };

    return fs.statAsync(path.join(virtualInstallPath, archiveName))
        .then(() => { useOldPath = true; })
        .catch(() => undefined)
        .then(() => {
          const fileLinks = modInfo.getElementsByTagName('fileLink');

          if ((fileLinks !== undefined) && (fileLinks.length > 0)) {
          res.fileEntries =
              Array.from(fileLinks)
                  .map(fileLink => transformFileEntry(fileLink, adjustRealPath))
                  .filter(entry => entry !== undefined);
          } else {
            res.fileEntries = [];
          }

          const modFilePath = path.join(res.archivePath, res.modFilename);

          return modmeta.genHash(modFilePath).catch(err => null);
        })
        .then((hashResult: modmetaT.IHashResult) => {
          res.archiveMD5 = hashResult.md5sum;
        })
        .catch(() => { res.archiveMD5 = null; })
        .then(() => res as IModEntry);
  });
}

export default parseNMMConfigFile;
