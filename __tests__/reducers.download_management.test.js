import { stateReducer } from '../src/extensions/download_management/reducers/state';

describe('addLocalDownload', () => {
  it('adds the download', () => {
    let input = { files: {} };
    let result = stateReducer.reducers.ADD_LOCAL_DOWNLOAD(input, 
      { id: 'newid', game: 'game', localPath: 'localPath', fileSize: 42 }
    );
    expect(result).toEqual({ files: { newid:
      { state: 'finished', game: 'game', localPath: 'localPath', size: 42, chunks: [], urls: [], modInfo: {} }
    } });
  });
});

/*
      { type: 'DOWNLOAD_PROGRESS', payload: { id: 'id', received: 42, total: 43 } }
      { type: 'FINISH_DOWNLOAD', payload: { id: 'id', state: 'state', failCause: 'failCause' } }
      { type: 'INIT_DOWNLOAD', payload:
        { id: 'id', urls: ['url1', 'url2'], modInfo: { key: 'value' }, game: 'game' }
      }
      { type: 'PAUSE_DOWNLOAD', payload: { id: 'id' } }
      { type: 'REMOVE_DOWNLOAD', payload: { id: 'id' } }
      { type: 'SET_DOWNLOAD_FILEPATH', payload:
        { id: 'id', filePath: 'filePath' }
      }
      { type: 'SET_DOWNLOAD_HASH', payload: { id: 'id', fileMD5: 'hash' } }
      { type: 'SET_DOWNLOAD_HASH_BY_FILE', payload:
        { fileName: 'filePath', fileMD5: 'hash', fileSize: 42 }
      }
      { type: 'SET_DOWNLOAD_SPEED', payload: 42 }
      { type: 'START_DOWNLOAD', payload: { id: 'id' } }
*/