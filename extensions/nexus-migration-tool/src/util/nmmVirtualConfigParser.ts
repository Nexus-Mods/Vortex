import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { IHashResult } from 'modmeta-db';
import * as path from 'path';
import {IFileEntry as FileEntry, IModEntry as ModEntry} from './nmmEntries';

export class NMMVirtualConfigParser {
  private sourceFile: string;

  constructor(nmmFilePath: string) {
    this.sourceFile = nmmFilePath;
  }

  public parseNMMInstall =
    (callback: (err, res: ModEntry[]) => void) => {
    const nmmModList: ModEntry[] = [];
    const parser = new DOMParser();
    fs.readFileAsync(this.sourceFile, (err, data) => {
        const xmlDoc = parser.parseFromString(data.toString('utf-8'), 'text/xml');
        const version = xmlDoc.getElementById('virtualModActivator');
        if (version === undefined) {
          // throw invalid file
        } else if (version.getAttribute('fileVersion') !== '0.3.0.0') {
          // throw unsupported version
        }

        const modInfoList = xmlDoc.getElementsByTagName('modInfo');
        if (modInfoList === undefined || modInfoList.length <= 0) {
          // throw nothing to import
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

          for (const fileLink of modInfo.childNodes) {
            const nodeRealPath: string = fileLink.attributes['realPath'];
            const nodeVirtualPath: string = fileLink.attributes['virtualPath'];
            const nodeLinkPriority = fileLink.childNodes[0].nodeValue;
            const nodeIsActive = fileLink.childNodes[1].nodeValue;

            const fileEntry: FileEntry = {
              fileSource: nodeRealPath,
              fileDestination: nodeVirtualPath,
              isActive: (nodeIsActive === 'true'),
              filePriority: (parseInt(nodeLinkPriority, 10)),
            };

            modFileEntries.push(fileEntry);
          }

          const { genHash } = require('modmeta-db');
          const modFilePath = path.join(elementArchivePath, elementModFilename);
          let fileMD5: string;

          fileMD5 = genHash(modFilePath)
                .then((hashResult: IHashResult) => {
                  return hashResult.md5sum;
                });

          const modEntry: ModEntry = {
            modId: elementModId,
            downloadId: elementDownloadId,
            modName: elementModName,
            modFilename: elementModFilename,
            archivePath: elementArchivePath,
            modVersion: elementModVersion,
            archiveMD5: fileMD5,
            fileEntries: modFileEntries,
          };

          nmmModList.push(modEntry);
        }
    });

    return Promise.resolve(callback(null, nmmModList));
  }
}
