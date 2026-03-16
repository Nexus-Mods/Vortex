import type { IFileInfo } from '@nexusmods/nexus-api';
import type { ILookupResult, IQuery } from 'modmeta-db';
import type { types } from 'vortex-api';

import * as https from 'https';
import * as semver from 'semver';
import { log } from 'vortex-api';

import type { ISMAPIIOQuery, ISMAPIResult } from './types';

import { GAME_ID } from './common';
import { SMAPI_IO_API_VERSION } from './constants';
import { coerce, semverCompare } from './util';

const SMAPI_HOST = 'smapi.io';

/**
 * Adapter for querying SMAPI.io compatibility metadata and translating results
 * into Vortex modmeta lookup responses.
 */

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
    const queryName = query.name;
    if (queryName === undefined) {
      return [];
    }

    const res = await this.findByNames([{ id: queryName }]);
    const firstResult = res[0];
    const main = firstResult?.metadata?.main;
    if ((firstResult === undefined) || (main === undefined)) {
      return [];
    }

    const key = this.makeKey(query);
    if (firstResult.metadata.nexusID !== undefined) {
      return this.lookupOnNexus(query, firstResult.metadata.nexusID, main.version);
    }

    return [{ key, value: {
      gameId: GAME_ID,
      fileMD5: '',
      fileName: queryName,
      fileSizeBytes: 0,
      fileVersion: '',
      sourceURI: main.url ?? '',
    } }];
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
                              version?: string)
                              : Promise<ILookupResult[]> {
    if (this.mAPI.ext?.ensureLoggedIn !== undefined) {
      await this.mAPI.ext.ensureLoggedIn();
    }

    const files: IFileInfo[] = await this.mAPI.ext.nexusGetModFiles?.(GAME_ID, nexusId) ?? [];

    const versionPattern = version !== undefined ? `>=${version}` : '*';

    const file = files
      .filter(iter => semver.satisfies(coerce(iter.version), versionPattern))
      .sort((lhs, rhs) => semverCompare(rhs.version, lhs.version))[0];

    if (file === undefined) {
      throw new Error('no file found');
    }
    return [{
      key: this.makeKey(query),
      value: {
        fileMD5: '',
        fileName: file.file_name ?? '',
        fileSizeBytes: file.size * 1024,
        fileVersion: file.version ?? '',
        gameId: GAME_ID,
        sourceURI: `nxm://${GAME_ID}/mods/${nexusId}/files/${file.file_id}`,
        logicalFileName: (query.name ?? '').toLowerCase(),
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
