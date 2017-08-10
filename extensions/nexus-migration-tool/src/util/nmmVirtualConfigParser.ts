import {IFileEntry as FileEntry, IModEntry as ModEntry, ParseError} from '../types/nmmEntries';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { IHashResult, ILookupResult, IReference, IRule } from 'modmeta-db';
import * as path from 'path';
import { log, types, util } from 'vortex-api';

export function parseNMMConfigFile(nmmFilePath: string, mods: any): Promise<any> {
  return fs.readFileAsync(nmmFilePath)
  .catch((err) => {
    return Promise.reject(
      new ParseError('The selected folder does not contain a VirtualModConfig.xml file.'));
  })
  .then((data) => {
    return parseModEntries(data.toString('utf-8'), mods);
  });
}

export function parseModEntries(xmlData: string, mods: any): Promise<ModEntry[]> {
  const nmmModList: ModEntry[] = [];
  const parser = new DOMParser();

  const modListSet = ((mods !== null) && (mods !== undefined)) ?
    new Set(Object.keys(mods).map((key: string) => mods[key].id)) : new Set();

  const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
  const version = xmlDoc.getElementsByTagName('virtualModActivator')[0];

  if ((version === null) || (version === undefined)) {
    return Promise.reject(new ParseError(
      'The selected folder does not contain a valid VirtualModConfig.xml file.'));
  } else if (version.getAttribute('fileVersion') !== '0.3.0.0') {
    return Promise.reject(
      new ParseError('The selected folder contains an older VirtualModConfig.xml file,'
      + 'you need to upgrade your NMM before proceeding with the mod import.'));
  }

  const modInfoList = xmlDoc.getElementsByTagName('modInfo');
  if (modInfoList === undefined || modInfoList.length <= 0) {
    return Promise.reject(
      new ParseError('The selected folder contains an empty VirtualModConfig.xml file.'));
  }

  for (const modInfo of modInfoList) {
    if (!modInfo.hasChildNodes) {
      continue;
    }

    const elementModId = modInfo.getAttribute('modId');
    const elementDownloadId = modInfo.getAttribute('downloadId');
    const elementModName = modInfo.getAttribute('modName');
    const elementModFilename = modInfo.getAttribute('modFileName');
    const elementArchivePath = modInfo.getAttribute('modFilePath');
    const elementModVersion = modInfo.getAttribute('FileVersion');

    const modFileEntries: FileEntry[] = [];

    for (const fileLink of modInfo.getElementsByTagName('fileLink')) {
      const nodeRealPath = fileLink.getAttribute('realPath');
      const nodeVirtualPath = fileLink.getAttribute('virtualPath');
      const nodeLinkPriority =
        fileLink.getElementsByTagName('linkPriority')[0].childNodes[0].nodeValue;
      const nodeIsActive = fileLink.getElementsByTagName('isActive')[0].childNodes[0].nodeValue;

      if ((nodeVirtualPath !== null) && (nodeVirtualPath !== undefined)) {
        const fileEntry: FileEntry = {
          fileSource: nodeRealPath,
          fileDestination: nodeVirtualPath,
          isActive: (nodeIsActive.toLocaleLowerCase() === 'true'),
          filePriority: (parseInt(nodeLinkPriority, 10)),
        };

        modFileEntries.push(fileEntry);
      }
    }

    const modFilePath = path.join(elementArchivePath, elementModFilename);
    let fileMD5: string = '';

    const { genHash } = require('modmeta-db');
    genHash(modFilePath)
      .then((hashResult: IHashResult) => {
          fileMD5 = hashResult.md5sum;
      });

    const derivedId: string = util.deriveInstallName(elementModName, '');

    const modEntry: ModEntry = {
      nexusId: elementModId,
      vortexId: derivedId,
      downloadId: elementDownloadId,
      modName: elementModName,
      modFilename: elementModFilename,
      archivePath: elementArchivePath,
      modVersion: elementModVersion,
      archiveMD5: fileMD5,
      importFlag: true,
      isAlreadyManaged: ((modListSet !== null) && (modListSet !== undefined)
        && (modListSet.entries.length > 0)) ? modListSet.has(derivedId) : false,
      fileEntries: modFileEntries,
    };

    nmmModList.push(modEntry);
  }

  return Promise.resolve(nmmModList);
}

export default parseNMMConfigFile;
