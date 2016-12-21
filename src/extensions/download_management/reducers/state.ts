import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, merge, setOrNop, setSafe } from '../../../util/storeHelper';
import * as action from '../actions/state';

/**
 * reducer for changes to ephemeral session state
 */
export const stateReducer: IReducerSpec = {
  reducers: {
    [action.initDownload]: (state, payload) => {
      return setSafe(state, [ 'files', payload.id ], {
        state: 'init',
        game: payload.game,
        urls: payload.urls,
        modInfo: payload.modInfo,
        chunks: [],
      });
    },
    [action.downloadProgress]: (state, payload) => {
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
      return merge(state, ['files', downloadId], {
        fileMD5: payload.fileMD5,
        size: payload.fileSize,
      });
    },
    [action.startDownload]: (state, payload) => {
      return setOrNop(state, [ 'files', payload.id, 'state' ], 'started');
    },
    [action.finishDownload]: (state, payload) => {
      return merge(state, [ 'files', payload.id ], {
        state: payload.state,
        failCause: payload.failCause,
      });
    },
    [action.pauseDownload]: (state, payload) => {
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
