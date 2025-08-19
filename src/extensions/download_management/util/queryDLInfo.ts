import Bluebird from 'bluebird';
import * as path from 'path';
import { Action } from 'redux';
import { IExtensionApi, ILookupResult } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { log } from '../../../util/log';
import { batchDispatch } from '../../../util/util';
import * as selectors from '../../gamemode_management/selectors';
import metaLookupMatch from '../../mod_management/util/metaLookupMatch';
import NXMUrl from '../../nexus_integration/NXMUrl';
import { convertNXMIdReverse } from '../../nexus_integration/util/convertGameId';
import { activeGameId } from '../../profile_management/selectors';
import { setDownloadModInfo } from '../actions/state';
import { downloadPathForGame } from '../selectors';

// Queue management for metadata lookups
interface IMetadataRequest {
  api: IExtensionApi;
  dlId: string;
  ignoreCache: boolean;
  resolve: (value?: void) => void;
  reject: (reason?: any) => void;
}

class MetadataLookupQueue {
  private static instance: MetadataLookupQueue;
  private queue: IMetadataRequest[] = [];
  private running: number = 0;
  private readonly maxConcurrent: number = 8; // TODO: change this once the fileHashes query is more efficient
  private recentLookups: Set<string> = new Set();

  public static getInstance(): MetadataLookupQueue {
    if (!MetadataLookupQueue.instance) {
      MetadataLookupQueue.instance = new MetadataLookupQueue();
    }
    return MetadataLookupQueue.instance;
  }

  public enqueue(api: IExtensionApi, dlIds: string[], ignoreCache: boolean): Promise<void> {
    const promises = dlIds.map(dlId => {
      const cacheKey = `${dlId}_${ignoreCache}`;
      if (this.recentLookups.has(cacheKey)) {
        log('debug', 'skipping duplicate metadata lookup', { dlId });
        return Promise.resolve();
      }

      this.recentLookups.add(cacheKey);
      // Remove from cache after 30 seconds
      setTimeout(() => this.recentLookups.delete(cacheKey), 30000);

      return new Promise<void>((resolve, reject) => {
        this.queue.push({ api, dlId, ignoreCache, resolve, reject });
        log('debug', 'metadata lookup queued', {
          dlId,
          queueLength: this.queue.length,
          running: this.running
        });
      });
    });

    this.processQueue();
    return Promise.all(promises).then(() => undefined);
  }

  private async processQueue(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) {
      return;
    }

    this.running++;

    log('debug', 'starting metadata lookup', { 
      dlId: request.dlId, 
      running: this.running, 
      queueLength: this.queue.length 
    });

    try {
      await this.executeQueryInfo(request.api, request.dlId, request.ignoreCache);
      request.resolve();
    } catch (error) {
      log('warn', 'metadata lookup failed', { dlId: request.dlId, error: error.message });
      request.reject(error);
    } finally {
      this.running--;
      log('debug', 'metadata lookup completed', {
        dlId: request.dlId,
        running: this.running,
        queueLength: this.queue.length
      });
      this.processQueue();
    }
  }

  private async executeQueryInfo(api: IExtensionApi, dlId: string, ignoreCache: boolean): Promise<void> {
    return queryInfoInternal(api, dlId, ignoreCache);
  }
}

function queryInfoInternal(api: IExtensionApi, dlId: string,
                   ignoreCache: boolean): Bluebird<void> {
  const state: IState = api.store.getState();

  const actions: Action[] = [];

  const knownGames = selectors.knownGames(state);

  const dl = state.persistent.downloads.files[dlId];
  if (dl === undefined) {
    log('warn', 'download no longer exists', dlId);
    return Bluebird.resolve();
  }

  if (!dl.fileMD5) {
    log('debug', 'skipping metadata lookup - no MD5 hash available', { dlId });
    return Bluebird.resolve();
  }

  const gameMode = activeGameId(state);
  const gameId = Array.isArray(dl.game) ? dl.game[0] : dl.game;
  const downloadPath = downloadPathForGame(state, gameId);
  if ((downloadPath === undefined) || (dl.localPath === undefined)) {
    // almost certainly dl.localPath is undefined with a bugged download
    return Bluebird.resolve();
  }
  log('info', 'lookup mod meta info', { dlId, md5: dl.fileMD5 });
  // note: this may happen in addition to and in parallel to a separate mod meta lookup
  //   triggered by the file being added to application state, but that should be fine because
  //   the mod meta information is cached locally, as is the md5 hash if it's not available here
  //   yet, so no work should be done redundantly
  const timeNow = Date.now();

  // Add timeout to prevent slow metadata lookups from blocking new downloads
  const lookupPromise = api.lookupModMeta({
    fileMD5: dl.fileMD5,
    filePath: path.join(downloadPath, dl.localPath),
    gameId,
    fileSize: dl.size,
  }, ignoreCache);

  const timeoutMs = 10000;
  // Apply timeout - if metadata lookup takes longer than 10 seconds, continue without it
  const timeoutPromise = new Promise<ILookupResult[]>((resolve) => {
    setTimeout(() => {
      log('warn', 'metadata lookup timed out, continuing without metadata', {
        dlId,
        timeoutMs,
        md5: dl.fileMD5
      });
      resolve([]);
    }, timeoutMs);
  });

  return Bluebird.resolve(Promise.race([lookupPromise, timeoutPromise]))
  .then((modInfo: ILookupResult[]) => {
    const match = metaLookupMatch(modInfo, dl.localPath, gameMode);
    const timeLookupFinished = Date.now();
    log('debug', 'mod meta lookup finished', {
      dlId,
      gameId,
      fileMD5: dl.fileMD5,
      timeLookupFinished,
      timeTaken: timeLookupFinished - timeNow,
    });
    if (match !== undefined) {
      const info = match.value;

      let metaGameId = info.gameId;
      if (info.domainName !== undefined) {
        metaGameId = convertNXMIdReverse(knownGames, info.domainName);
      }

      const dlNow = api.getState().persistent.downloads.files[dlId];

      const setInfo = (key: string, value: any) => {
        if (value !== undefined) { actions.push(setDownloadModInfo(dlId, key, value)); }
      };

      setInfo('meta', info);

      try {
        const nxmUrl = new NXMUrl(info.sourceURI);
        // if the download already has a file id (because we downloaded from nexus)
        // and what we downloaded doesn't match the md5 lookup, the server probably gave us
        // incorrect data, so ignore all of it
        if ((dlNow?.modInfo?.nexus?.ids?.fileId !== undefined)
            && (dlNow?.modInfo?.nexus?.ids?.fileId !== nxmUrl.fileId)) {
          return Promise.resolve();
        }

        setInfo('source', 'nexus');
        setInfo('nexus.ids.gameId', nxmUrl.gameId);
        setInfo('nexus.ids.fileId', nxmUrl.fileId);
        setInfo('nexus.ids.modId', nxmUrl.modId);
        metaGameId = convertNXMIdReverse(knownGames, nxmUrl.gameId);
      } catch (err) {
        // failed to parse the uri as an nxm link - that's not an error in this case, if
        // the meta server wasn't nexus mods this is to be expected
        if (dlNow?.modInfo?.source === undefined) {
          setInfo('source', 'unknown');
        }
      }
      if (gameId !== metaGameId) {
        // Run game assignment asynchronously without blocking metadata lookup completion
        // Pass extra parameter to indicate this is from metadata lookup
        api.emitAndAwait('set-download-games', dlId, [metaGameId, gameId], true)
          .catch(err => {
            log('warn', 'failed to set download games', { dlId, gameId, metaGameId, error: err.message });
          });
      }
      return Promise.resolve();
    }
  })
  .catch(err => {
    log('warn', 'failed to look up mod meta info', { message: err.message });
  })
  .finally(() => {
    // Defer the batch dispatch to prevent blocking the metadata lookup completion
    if (actions.length > 0) {
      setImmediate(() => {
        batchDispatch(api.store, actions);
      });
    }
    log('debug', 'done querying info', { dlId });
  });
}

// Public interface that uses the queue
function queryInfo(api: IExtensionApi, dlIds: string[], ignoreCache: boolean): Promise<void> {
  const queue = MetadataLookupQueue.getInstance();
  return queue.enqueue(api, dlIds, ignoreCache);
}

export default queryInfo;
