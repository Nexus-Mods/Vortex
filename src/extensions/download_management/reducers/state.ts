import { IReducerSpec } from '../../../types/IExtensionContext';
import { terminate } from '../../../util/errorHandling';
import { log } from '../../../util/log';
import { deleteOrNop, getSafe, merge, setOrNop, setSafe } from '../../../util/storeHelper';

import * as action from '../actions/state';

export const speedDataPoints = 30;

/**
 * reducer for changes to ephemeral session state
 */
export const stateReducer: IReducerSpec = {
  reducers: {
    [action.initDownload as any]: (state, payload) => {
      if (state.files[payload.id] !== undefined) {
        // The code that called this action can't continue using this id.
        // We rely on the calling code to have a reliable way of generating unique id so
        // it's not worth the effort to code error handling for this.
        terminate({
          message: 'Invalid state change',
          details: 'An attempt was made to change application state in a way that '
                   + 'would destroy user data. The action was: \'initDownload\' '
                   + 'with id \'' + payload.id + '\'.'
                   + 'This is a bug in the calling code, please report id.',
        });
        return state;
      }
      return setSafe(state, [ 'files', payload.id ], {
        state: 'init',
        game: payload.game,
        urls: payload.urls,
        modInfo: payload.modInfo,
        chunks: [],
        localPath: undefined,
        fileMD5: undefined,
      });
    },
    [action.downloadProgress as any]: (state, payload) => {
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return merge(state, [ 'files', payload.id ], {
        state: 'started',
        received: payload.received,
        size: payload.total,
      });
    },
    [action.setDownloadFilePath as any]: (state, payload) =>
      setOrNop(state, [ 'files', payload.id, 'localPath' ], payload.filePath),
    [action.setDownloadHash as any]: (state, payload) =>
      setOrNop(state, [ 'files', payload.id, 'fileMD5' ], payload.fileMD5),
    [action.setDownloadHashByFile as any]: (state, payload) => {
      const downloadId = Object.keys(state.files || {}).find(
        (id: string) => state.files[id].localPath === payload.fileName);
      if (downloadId === undefined) {
        log('warn', 'unknown download', payload.fileName);
        return state;
      }
      return merge(state, ['files', downloadId], {
        fileMD5: payload.fileMD5,
        size: payload.fileSize,
      });
    },
    [action.startDownload as any]: (state, payload) => {
      if (getSafe<string>(state, [ 'files', payload.id, 'state' ], 'unknown') !== 'init') {
        return state;
      }
      return setOrNop(state, [ 'files', payload.id, 'state' ], 'started');
    },
    [action.finishDownload as any]: (state, payload) => {
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return merge(state, [ 'files', payload.id ], {
        state: payload.state,
        failCause: payload.failCause,
      });
    },
    [action.pauseDownload as any]: (state, payload) => {
      if (['finished', 'failed'].indexOf(
          getSafe(state, [ 'files', payload.id, 'state' ], undefined)) !== -1) {
        return state;
      }
      return setOrNop(state, [ 'files', payload.id, 'state' ],
                      payload.paused ? 'paused' : 'started');
    },
    [action.setDownloadSpeed as any]: (state, payload) => {
      const temp = setSafe(state, ['speed'], payload);
      let speeds = state.speedHistory !== undefined ? state.speedHistory.slice() : [];
      speeds.push(payload);
      if (speeds.length > speedDataPoints) {
        speeds = speeds.slice(speeds.length - speedDataPoints);
      }
      return setSafe(temp, ['speedHistory'], speeds);
    },
    [action.removeDownload as any]: (state, payload) =>
      deleteOrNop(state, [ 'files', payload.id ]),
    [action.addLocalDownload as any]: (state, payload) =>
      setSafe(state, [ 'files', payload.id ], {
        state: 'finished',
        game: payload.game,
        localPath: payload.localPath,
        size: payload.fileSize,
        urls: [],
        modInfo: {},
        chunks: [],
      }),
  },
  defaults: {
    speed: 0,
    speedHistory: [],
    files: {},
  },
};
