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

function queryInfo(api: IExtensionApi, dlIds: string[],
                   ignoreCache: boolean): Bluebird<void> {
  const state: IState = api.store.getState();

  const actions: Action[] = [];

  const knownGames = selectors.knownGames(state);

  return Bluebird.map(dlIds ?? [], dlId => {
    const dl = state.persistent.downloads.files[dlId];
    if (dl === undefined) {
      log('warn', 'download no longer exists', dlId);
      return;
    }
    const gameMode = activeGameId(state);
    const gameId = Array.isArray(dl.game) ? dl.game[0] : dl.game;
    const downloadPath = downloadPathForGame(state, gameId);
    if ((downloadPath === undefined) || (dl.localPath === undefined) || (dl.state !== 'finished')) {
      // almost certainly dl.localPath is undefined with a bugged download
      return;
    }
    log('info', 'lookup mod meta info', { dlId, md5: dl.fileMD5 });
    // note: this may happen in addition to and in parallel to a separate mod meta lookup
    //   triggered by the file being added to application state, but that should be fine because
    //   the mod meta information is cached locally, as is the md5 hash if it's not available here
    //   yet, so no work should be done redundantly
    return api.lookupModMeta({
      fileMD5: dl.fileMD5,
      filePath: path.join(downloadPath, dl.localPath),
      gameId,
      fileSize: dl.size,
    }, ignoreCache)
    .then((modInfo: ILookupResult[]) => {
      const match = metaLookupMatch(modInfo, dl.localPath, gameMode);
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
            return Bluebird.resolve();
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
        return (gameId !== metaGameId)
          ? api.emitAndAwait('set-download-games', dlId, [metaGameId, gameId])
          : Bluebird.resolve();
      }
    })
    .catch(err => {
      log('warn', 'failed to look up mod meta info', { message: err.message });
    });
  })
  .finally(() => {
    batchDispatch(api.store, actions);
  })
  .then(() => {
    log('debug', 'done querying info', { archiveIds: dlIds });
  });
}

export default queryInfo;
