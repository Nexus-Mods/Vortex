import { IReducerSpec, VerifierDropParent } from '../../../types/IExtensionContext';
import { terminate } from '../../../util/errorHandling';
import { deleteOrNop, getSafe, merge, setOrNop, setSafe } from '../../../util/storeHelper';

import * as action from '../actions/state';

import * as _ from 'lodash';
import { inspect } from 'util';

export const NUM_SPEED_DATA_POINTS = 30;

/**
 * reducer for changes to ephemeral session state
 */
export const stateReducer: IReducerSpec = {
  reducers: {
    [action.initDownload as any]: (state, payload) => {
      if (typeof(payload.id) !== 'string') { throw new Error('invalid download id'); }
      if (state.files[payload.id] !== undefined) {
        // The code that called this action can't continue using this id.
        // We rely on the calling code to have a reliable way of generating unique id so
        // it's not worth the effort to code error handling for this.
        terminate({
          message: 'Invalid state change',
          details: 'An attempt was made to change application state in a way that '
                   + 'would destroy user data. The action was: \'initDownload\' '
                   + 'with id \'' + payload.id + '\'.'
                   + 'This is a bug in the calling code, please report it.',
        }, {});
        return state;
      }
      return setSafe(state, [ 'files', payload.id ], {
        state: 'init',
        game: payload.games,
        urls: payload.urls,
        modInfo: payload.modInfo,
        chunks: [],
        fileTime: Date.now(),
      });
    },
    [action.downloadProgress as any]: (state, payload) => {
      if (typeof(payload.id) !== 'string') { throw new Error('invalid download id'); }
      if (state.files[payload.id] === undefined) {
        return state;
      }
      const update = {
        received: payload.received,
        size: payload.total,
      };
      if (state.files[payload.id].state === 'init') {
        update['state'] = payload.received > 0 ? 'started' : 'init';
      }
      if (payload.chunks !== undefined) {
        update['chunks'] = payload.chunks;
      }
      if (payload.urls !== undefined) {
        update['urls'] = payload.urls;
      }
      return merge(state, [ 'files', payload.id ], update);
    },
    [action.finalizingProgress as any]: (state, payload) => {
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return setSafe(state, [ 'files', payload.id, 'verified' ], payload.progress);
    },
    [action.setDownloadFilePath as any]: (state, payload) =>
      setOrNop(state, [ 'files', payload.id, 'localPath' ], payload.filePath),
    [action.setDownloadPausable as any]: (state, payload) =>
      setOrNop(state, ['files', payload.id, 'pausable'], payload.pausable),
    [action.setDownloadHash as any]: (state, payload) =>
      setOrNop(state, [ 'files', payload.id, 'fileMD5' ], payload.fileMD5),
    [action.setDownloadHashByFile as any]: (state, payload) => {
      const downloadId = Object.keys(state.files || {}).find(
        (id: string) => state.files[id].localPath === payload.fileName);
      if (downloadId === undefined) {
        return state;
      }
      if (typeof(downloadId) !== 'string') { throw new Error('invalid download id'); }
      return merge(state, ['files', downloadId], {
        fileMD5: payload.fileMD5,
        size: payload.fileSize,
      });
    },
    [action.setDownloadInterrupted as any]: (state, payload) => {
      if (typeof(payload.id) !== 'string') { throw new Error('invalid download id'); }
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return merge(state, [ 'files', payload.id ], {
        state: 'paused',
        received: payload.realReceived,
      });
    },
    [action.startDownload as any]: (state, payload) => {
      if (typeof(payload.id) !== 'string') { throw new Error('invalid download id'); }
      if (getSafe<string>(state, [ 'files', payload.id, 'state' ], 'unknown') !== 'init') {
        return state;
      }
      return merge(state, [ 'files', payload.id ], {
        state: 'started',
        startTime: Date.now(),
      });
    },
    [action.finishDownload as any]: (state, payload) => {
      if (typeof(payload.id) !== 'string') { throw new Error('invalid download id'); }
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return merge(state, [ 'files', payload.id ], {
        state: payload.state,
        failCause: payload.failCause,
        fileTime: Date.now(),
        chunks: [],
      });
    },
    [action.finalizingDownload as any]: (state, payload) => {
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return setSafe(state, ['files', payload.id, 'state'], 'finalizing');
    },
    [action.setDownloadTime as any]: (state, payload) => merge(state, ['files', payload.id], {
      fileTime: payload.time,
    }),
    [action.pauseDownload as any]: (state, payload) => {
      const { id, paused, chunks } = payload;
      const oldDLState = state.files?.[id]?.state;
      if (['finished', 'finalizing', undefined].includes(oldDLState)
          || ((oldDLState === 'failed') && paused)) {
        // failed downloads can be retried, otherwise we only allow resuming paused and pausing
        // active downloads
        return state;
      }
      if (chunks !== undefined) {
        state = setOrNop(state, ['files', id, 'chunks'], chunks);
      }
      const newState = paused
        ? 'paused'
        : ((state.files?.[id]?.received ?? 0) > 0)
          ? 'started'
          : 'init';
      return setOrNop(state, [ 'files', id, 'state' ], newState);
    },
    [action.setDownloadSpeed as any]: (state, payload) => {
      const temp = setSafe(state, ['speed'], payload);
      let speeds = state.speedHistory !== undefined ? state.speedHistory.slice() : [];
      speeds.push(payload);
      if (speeds.length > NUM_SPEED_DATA_POINTS) {
        speeds = speeds.slice(speeds.length - NUM_SPEED_DATA_POINTS);
      }
      return setSafe(temp, ['speedHistory'], speeds);
    },
    [action.setDownloadSpeeds as any]: (state, payload) => {
      const temp = setSafe(state, ['speed'], payload[payload.length - 1]);
      return setSafe(temp, ['speedHistory'], payload);
    },
    [action.removeDownload as any]: (state, payload) =>
      deleteOrNop(state, [ 'files', payload.id ]),
    [action.addLocalDownload as any]: (state, payload) =>
      setSafe(state, [ 'files', payload.id ], {
        state: 'finished',
        game: [ payload.game ],
        localPath: payload.localPath,
        size: payload.fileSize,
        fileTime: Date.now(),
        urls: [],
        modInfo: {},
        chunks: [],
      }),
    [action.setDownloadModInfo as any]: (state, payload) => {
      if (typeof(payload.id) !== 'string') {
        throw new Error('invalid download id: ' + inspect(payload.id));
      }
      if (state.files[payload.id] === undefined) {
        return state;
      }

      return setSafe(state,
        ['files', payload.id, 'modInfo'].concat(payload.key.split('.')),
        payload.value);
    },
    [action.mergeDownloadModInfo as any]: (state, payload) => {
      const { id, value } = payload;

      if (typeof(id) !== 'string') { throw new Error('invalid download id'); }

      if (state.files[payload.id] === undefined) {
        return state;
      }

      return setSafe(state,
        ['files', id, 'modInfo'],
        _.merge(state.files[id]?.modInfo || {}, value));
    },
    [action.setDownloadInstalled as any]: (state, payload) =>
      setSafe(state,
        ['files', payload.id, 'installed'],
        { gameId: payload.gameId, modId: payload.modId }),
    [action.setCompatibleGames as any]: (state, payload) =>
      setSafe(state, ['files', payload.id, 'game'], payload.games),
  },
  defaults: {
    speed: 0,
    speedHistory: [],
    files: {},
  },
  verifiers: {
    files: {
      // shouldn't be reported atm
      description: () => 'Severe! Invalid list of archives',
      elements: {
        _: {
          // shouldn't be reported atm
          description: () => 'Invalid download',
          elements: {
            game: {
              description: () => 'Download to game assignment stored incorrectly will be repaired.',
              required: true,
              type: 'array',
              noNull: true,
              noUndefined: true,
              /* Would be nice if we could check the game assignment for validity here, but
               * right now (as of 1.3.5), the main issue we're facing is downloads that have been
               * placed in the download base directory and those wouldn't be added again and thus
               * left orphaned, with no in-application way of removing them
              elements: {
                _:  {
                  description: () => 'Download to game assignment stored incorrectly will be repaired.',
                  noNull: true,
                  noUndefined: true,
                  deleteBroken: 'parent',
                },
              },
              */
              repair: input => {
                if (input !== undefined) {
                  return [input];
                 } else {
                  throw new VerifierDropParent();
                 }
              },
            },
          },
        },
      },
    },
  },
};
