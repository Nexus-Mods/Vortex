import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export interface IModEntry {
  modId: string;
  downloadId: string;
  modName: string;
  modFilename: string;
  archivePath: string;
  modVersion: string;
  fileEntries: IFileEntry[];
}

export interface IFileEntry {
  fileSource: string;
  fileDestination: string;
  isActive: boolean;
  filePriority: number;
}

export class NMMVirtualConfigParser {
  private source: string;

  constructor(nmmFilePath: string) {
    this.source = nmmFilePath;
  }

  public parseNMMInstall =
    (callback: (err, res: IModEntry[]) => void) => {
    const nmmModList: IModEntry[] = [];
    const parser = new DOMParser();
    fs.readFile(this.source, (err, data) => {
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

          const modFileEntries: IFileEntry[] = [];

          for (const fileLink of modInfo.childNodes) {
            const nodeRealPath: string = fileLink.attributes['realPath'];
            const nodeVirtualPath: string = fileLink.attributes['virtualPath'];
            const nodeLinkPriority = fileLink.childNodes[0].nodeValue;
            const nodeIsActive = fileLink.childNodes[1].nodeValue;

            const fileEntry: IFileEntry = {
              fileSource: nodeRealPath,
              fileDestination: nodeVirtualPath,
              isActive: (nodeIsActive === 'true'),
              filePriority: (parseInt(nodeLinkPriority, 10)),
            };

            modFileEntries.push(fileEntry);
          }

          const modEntry: IModEntry = {
            modId: elementModId,
            downloadId: elementDownloadId,
            modName: elementModName,
            modFilename: elementModFilename,
            archivePath: elementArchivePath,
            modVersion: elementModVersion,
            fileEntries: modFileEntries,
          };

          nmmModList.push(modEntry);
        }
    });

    return Promise.resolve(callback(null, nmmModList));
  }
}
