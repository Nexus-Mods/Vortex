import { IFileInfo } from '@nexusmods/nexus-api';
import * as https from 'https';
import { ILookupResult, IQuery } from 'modmeta-db';
import * as semver from 'semver';
import { log, types } from 'vortex-api';
import { GAME_ID } from './common';
import { SMAPI_IO_API_VERSION } from './constants';
import { ISMAPIIOQuery, ISMAPIResult } from './types';
import { coerce, semverCompare } from './util';

const SMAPI_HOST = 'smapi.io';

class SMAPIProxy {
  private mAPI: types.IExtensionApi;
  private mOptions: https.RequestOptions;
  constructor(api: types.IExtensionApi) {
    this.mAPI = api;
    this.mOptions = {
      host: SMAPI_HOST,
      method: 'POST',
      protocol: 'https:',
      path: '/api/v3.0/mods',
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  public async find(query: IQuery): Promise<ILookupResult[]> {
    if (query.name !== undefined) {
      const res = await this.findByNames([{ id: query.name }]);
      if ((res.length === 0) || (res[0].metadata?.main === undefined)) {
        return [];
      }
      const key = this.makeKey(query);
      if (res[0].metadata.nexusID !== undefined) {
        return await this.lookupOnNexus(
          query, res[0].metadata.nexusID, res[0].metadata.main.version);
      } else {
        return [
          { key, value: {
            gameId: GAME_ID,
            fileMD5: undefined,
            fileName: query.name,
            fileSizeBytes: 0,
            fileVersion: '',
            sourceURI: res[0].metadata.main?.url,
          } },
        ];
      }
    } else {
      return [];
    }
  }

  public async findByNames(query: ISMAPIIOQuery[]): Promise<ISMAPIResult[]> {
    return new Promise((resolve, reject) => {
      const req = https.request(this.mOptions, res => {
        let body = Buffer.from([]);
        res
          .on('error', err => reject(err))
          .on('data', chunk => {
            body = Buffer.concat([body, chunk]);
          })
          .on('end', () => {
            const textual = body.toString('utf8');
            try {
              const parsed = JSON.parse(textual);
              resolve(parsed);
            } catch (err) {
              log('error', 'failed to parse smapi response', textual);
              reject(err);
            }
          });
      })
        .on('error', err => reject(err))
      req.write(JSON.stringify({
        mods: query,
        includeExtendedMetadata: true,
        apiVersion: SMAPI_IO_API_VERSION,
      }));
      req.end();
    });
  }

  private makeKey(query: IQuery): string {
    return `smapio:${query.name}:${query.versionMatch}`;    
  }

  private async lookupOnNexus(query: IQuery,
                              nexusId: number,
                              version: string)
                              : Promise<ILookupResult[]> {
    await this.mAPI.ext.ensureLoggedIn();

    const files: IFileInfo[] = await this.mAPI.ext.nexusGetModFiles?.(GAME_ID, nexusId) ?? [];

    const versionPattern = `>=${version}`;

    const file = files
      .filter(iter => semver.satisfies(coerce(iter.version), versionPattern))
      .sort((lhs, rhs) => semverCompare(rhs.version, lhs.version))[0];

    if (file === undefined) {
      throw new Error('no file found');
    }
    return [{
      key: this.makeKey(query),
      value: {
        fileMD5: undefined,
        fileName: file.file_name,
        fileSizeBytes: file.size * 1024,
        fileVersion: file.version,
        gameId: GAME_ID,
        sourceURI: `nxm://${GAME_ID}/mods/${nexusId}/files/${file.file_id}`,
        logicalFileName: query.name.toLowerCase(),
        source: 'nexus',
        domainName: GAME_ID,
        details: {
          category: file.category_id.toString(),
          description: file.description,
          modId: nexusId.toString(),
          fileId: file.file_id.toString(),
        }
      },
    }];
  }
}

export default SMAPIProxy;
