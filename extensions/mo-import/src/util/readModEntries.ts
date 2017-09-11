import {IModEntry} from '../types/moEntries';

import * as Promise from 'bluebird';
import { FileAccessError } from 'core-error-predicates';
import * as fs from 'fs-extra-promise';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';
import { log, types } from 'vortex-api';

const parser: IniParser = new IniParser(new WinapiFormat());

function convertMOVersion(input: string): string {
  return input.replace(/^[df]/, '');
}

interface IMetaInfo {
  modid: number;
  fileid: number;
  installationFile: string;
  version: string;
  categoryIds: number[];
}

function parseMetaIni(modPath: string): Promise<IMetaInfo> {
  return parser.read(path.join(modPath, 'meta.ini'))
      .then((ini: any) => {
        const fileId = ini.data.installedFiles !== undefined
          ? ini.data.installedFiles['1\\fileid']
          : undefined;
        const categoryIds = ini.data.General.category.replace(/^"|"$/g, '').split(',');
        return {
          modid: parseInt(ini.data.General.modid, 10),
          fileid: fileId !== undefined ? parseInt(fileId, 10) : undefined,
          installationFile: ini.data.General.installationFile,
          version: convertMOVersion(ini.data.General.version),
          categoryIds: categoryIds.map(id => parseInt(id, 10)),
        };
      });
}

function dirsOnly(filePath: string): Promise<boolean> {
  return fs.statAsync(filePath)
      .then(stat => stat.isDirectory())
      .catch(FileAccessError, () => false);
}

function readModEntries(basePath: string,
                        mods: { [modId: string]: types.IMod }): Promise<IModEntry[]> {
  return fs.readdirAsync(basePath)
    .filter(fileName => dirsOnly(path.join(basePath, fileName)))
    .map(modPath => parseMetaIni(path.join(basePath, modPath))
      .then(metaInfo => ({
        vortexId: modPath,
        nexusId: metaInfo.modid,
        downloadId: metaInfo.fileid,
        modName: modPath,
        archiveName: metaInfo.installationFile,
        modVersion: metaInfo.version,
        importFlag: true,
        isAlreadyManaged: mods[modPath] !== undefined,
        categoryId: metaInfo.categoryIds[0],
      }))
      .catch(err => {
        log('warn', 'failed to read MO mod', { modPath, err: err.message });
        return undefined;
      }))
    .filter(entry => entry !== undefined);
}

export default readModEntries;
