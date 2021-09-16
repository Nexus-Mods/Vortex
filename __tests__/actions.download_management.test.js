import * as actions from '../src/extensions/download_management/actions/state';

describe('addLocalDownload', () => {
  it('creates the action', () => {
    let action = actions.addLocalDownload('id', 'game', 'localPath', 42);
    expect(action).toEqual(
      { error: false, type: 'ADD_LOCAL_DOWNLOAD', payload: { id: 'id', game: 'game', localPath: 'localPath', fileSize: 42 } }
    );
  });
});

describe('downloadProgress', () => {
  it('creates the action', () => {
    let action = actions.downloadProgress('id', 42, 43);
    expect(action).toEqual(
      { error: false, type: 'DOWNLOAD_PROGRESS', payload: { id: 'id', received: 42, total: 43 } }
    );
  });
});

describe('finishDownload', () => {
  it('creates the action', () => {
    let action = actions.finishDownload('id', 'state', 'failCause');
    expect(action).toEqual(
      { error: false, type: 'FINISH_DOWNLOAD', payload: { id: 'id', state: 'state', failCause: 'failCause' } }
    );
  });
});

describe('initDownload', () => {
  it('creates the action', () => {
    let action = actions.initDownload('id', ['url1', 'url2'], { key: 'value' }, 'game');
    expect(action).toEqual(
      { error: false, type: 'INIT_DOWNLOAD', payload:
        { id: 'id', urls: ['url1', 'url2'], modInfo: { key: 'value' }, game: 'game' }
      }
    );
  });
});

describe('pauseDownload', () => {
  it('creates the action', () => {
    let action = actions.pauseDownload('id');
    expect(action).toEqual(
      { error: false, type: 'PAUSE_DOWNLOAD', payload: { id: 'id' } }
    );
  });
});

describe('removeDownload', () => {
  it('creates the action', () => {
    let action = actions.removeDownload('id');
    expect(action).toEqual(
      { error: false, type: 'REMOVE_DOWNLOAD', payload: { id: 'id' } }
    );
  });
});

describe('setDownloadFilePath', () => {
  it('creates the action', () => {
    let action = actions.setDownloadFilePath('id', 'filePath');
    expect(action).toEqual(
      { error: false, type: 'SET_DOWNLOAD_FILEPATH', payload:
        { id: 'id', filePath: 'filePath' }
      }
    );
  });
});

describe('setDownloadHash', () => {
  it('creates the action', () => {
    let action = actions.setDownloadHash('id', 'hash');
    expect(action).toEqual(
      { error: false, type: 'SET_DOWNLOAD_HASH', payload: { id: 'id', fileMD5: 'hash' } }
    );
  });
});

describe('setDownloadHashByFile', () => {
  it('creates the action', () => {
    let action = actions.setDownloadHashByFile('filePath', 'hash', 42);
    expect(action).toEqual(
      { error: false, type: 'SET_DOWNLOAD_HASH_BY_FILE', payload:
        { fileName: 'filePath', fileMD5: 'hash', fileSize: 42 }
      }
    );
  });
});

describe('setDownloadSpeed', () => {
  it('creates the action', () => {
    let action = actions.setDownloadSpeed(42);
    expect(action).toEqual(
      {
        error: false,
        type: 'SET_DOWNLOAD_SPEED',
        payload: 42,
        meta: {
          forward: false,
          scope: 'local'
        },
      }
    );
  });
});

describe('startDownload', () => {
  it('creates the action', () => {
    let action = actions.startDownload('id');
    expect(action).toEqual(
      { error: false, type: 'START_DOWNLOAD', payload: { id: 'id' } }
    );
  });
});
