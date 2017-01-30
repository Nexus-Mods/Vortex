import { IReducerSpec } from '../../../types/IExtensionContext';
import { terminate } from '../../../util/errorHandling';
import { deleteOrNop, getSafe, merge, setOrNop, setSafe } from '../../../util/storeHelper';

import * as action from '../actions/state';

/**
 * reducer for changes to ephemeral session state
 */
export const stateReducer: IReducerSpec = {
  reducers: {
    [action.initDownload]: (state, payload) => {
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
    [action.downloadProgress]: (state, payload) => {
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return merge(state, [ 'files', payload.id ], {
        state: 'started',
        received: payload.received,
        size: payload.total,
      });
    },
    [action.setDownloadFilePath]: (state, payload) => {
      return setOrNop(state, [ 'files', payload.id, 'localPath' ], payload.filePath);
    },
    [action.setDownloadHash]: (state, payload) => {
      return setOrNop(state, [ 'files', payload.id, 'fileMD5' ], payload.fileMD5);
    },
    [action.setDownloadHashByFile]: (state, payload) => {
      const downloadId = Object.keys(state.files).find(
        (id: string) => state.files[id].localPath === payload.fileName);
      if (downloadId === undefined) {
        return state;
      }
      return merge(state, ['files', downloadId], {
        fileMD5: payload.fileMD5,
        size: payload.fileSize,
      });
    },
    [action.startDownload]: (state, payload) => {
      if (getSafe<string>(state, [ 'files', payload.id, 'state' ], 'unknown') !== 'init') {
        return state;
      }
      return setOrNop(state, [ 'files', payload.id, 'state' ], 'started');
    },
    [action.finishDownload]: (state, payload) => {
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return merge(state, [ 'files', payload.id ], {
        state: payload.state,
        failCause: payload.failCause,
      });
    },
    [action.pauseDownload]: (state, payload) => {
      if (['finished', 'failed'].indexOf(
          getSafe(state, [ 'files', payload.id, 'state' ], undefined)) !== -1) {
        return state;
      }
      return setOrNop(state, [ 'files', payload.id, 'state' ],
                      payload.paused ? 'paused' : 'started');
    },
    [action.setDownloadSpeed]: (state, payload) => {
      if (payload !== state.speed) {
        return setSafe(state, [ 'speed' ], payload);
      } else {
        return state;
      }
    },
    [action.removeDownload]: (state, payload) => {
      return deleteOrNop(state, [ 'files', payload.id ]);
    },
    [action.addLocalDownload]: (state, payload) => {
      return setSafe(state, [ 'files', payload.id ], {
        state: 'finished',
        game: payload.game,
        localPath: payload.localPath,
        size: payload.fileSize,
        urls: [],
        modInfo: {},
        chunks: [],
      });
    },
  },
  defaults: {
    speed: 0,
    files: {},
  },
};
