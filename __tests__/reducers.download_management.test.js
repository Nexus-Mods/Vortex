import { stateReducer } from '../src/extensions/download_management/reducers/state';
import * as _ from 'lodash';

jest.mock('../src/util/errorHandling', () => ({
  terminate: jest.fn(),
}));

const { terminate } = require('../src/util/errorHandling');

describe('addLocalDownload', () => {
  it('adds the download', () => {
    let input = { files: {} };
    let result = stateReducer.reducers.ADD_LOCAL_DOWNLOAD(input,
      { id: 'newid', game: 'game', localPath: 'localPath', fileSize: 42 }
    );

    _.unset(result, ['files', 'newid', 'fileTime']);
    expect(result).toEqual({ files: { newid:
      { state: 'finished', game: ['game'], localPath: 'localPath', size: 42, chunks: [], urls: [], modInfo: {} }
    } });
  });
});

describe('downloadProgress', () => {
  it('updates the progress', () => {
    const input = { files: { id: { state: 'started', received: 0, size: 43 } } };
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(input, { id: 'id', received: 42, total: 43 });
    expect(result).toEqual({ files: { id:
      { state: 'started', received: 42, size: 43 }
    } });
  });
  it('updates the total', () => {
    const input = { files: { id: { state: 'started', received: 0, size: 0 } } };
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(input, { id: 'id', received: 0, total: 43 });
    expect(result).toEqual({ files: { id:
      { state: 'started', received: 0, size: 43 }
    } });
  });
  it('sets the state to started', () => {
    const input = { files: { id: { state: 'init', received: 0, size: 43 } } };
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(input, { id: 'id', received: 1, total: 43 });
    expect(result).toEqual({ files: { id:
      { state: 'started', received: 1, size: 43 }
    } });
  });
  it('does nothing if the id is unknown', () => {
    const input = { files: { someid: { state: 'init', received: 0, size: 50 } } };
    const result = stateReducer.reducers.DOWNLOAD_PROGRESS(input, { id: 'id', received: 0, total: 43 });
    expect(result).toBe(input);
  });
});

describe('finishDownload', () => {
  it('finishes a download', () => {
    const input = { files: { id: { state: 'started' } } };
    const result = stateReducer.reducers.FINISH_DOWNLOAD(input, { id: 'id', state: 'finished' });
    _.unset(result, ['files', 'id', 'fileTime']);
    expect(result).toEqual({ files: { id: { chunks: [], failCause: undefined, state: 'finished' } } });
  });
  it('stores failure reason', () => {
    const input = { files: { id: { state: 'started' } } };
    const result = stateReducer.reducers.FINISH_DOWNLOAD(input, { id: 'id', state: 'failed', failCause: 'because error' });
    _.unset(result, ['files', 'id', 'fileTime']);
    expect(result).toEqual({ files: { id: { chunks: [], state: 'failed', failCause: 'because error' } } });
  });
  it('does nothing if the id is unknown', () => {
    const input = { files: { id: { state: 'started' } } };
    const result = stateReducer.reducers.FINISH_DOWNLOAD(input, { id: 'differentid', state: 'finished' });
    expect(result).toEqual({ files: { id: { state: 'started' } } });
  });
});

describe('initDownload', () => {
  it('initialises a download', () => {
    const input = { files: {} };
    const result = stateReducer.reducers.INIT_DOWNLOAD(input, { id: 'id', urls: ['url1', 'url2'], modInfo: { key: 'value' }, games: ['game'] });
    _.unset(result, ['files', 'id', 'fileTime']);
    expect(result).toEqual({ files: { id: {
      chunks: [], state: 'init', urls: ['url1', 'url2'], modInfo: { key: 'value' }, game: ['game'],
    } } });
  });
  it('terminates if the id exists', () => {
    const input = { files: { id: { state: 'started' } } };
    const result = stateReducer.reducers.INIT_DOWNLOAD(input, { id: 'id', urls: ['url1', 'url2'], modInfo: { key: 'value' }, games: ['game'] });
    expect(terminate.mock.calls.length).toEqual(1);
  });
});

describe('pauseDownload', () => {
  it('pauses a running download', () => {
    const input = { files: { id: { state: 'started', received: 1, size: 2 } } };
    const result = stateReducer.reducers.PAUSE_DOWNLOAD(input, { id: 'id', paused: true });
    expect(result).toEqual({ files: { id: { state: 'paused', received: 1, size: 2 } } });
  });
  it('resumes a paused download', () => {
    const input = { files: { id: { state: 'paused', received: 1, size: 2 } } };
    const result = stateReducer.reducers.PAUSE_DOWNLOAD(input, { id: 'id', paused: false });
    expect(result).toEqual({ files: { id: { state: 'started', received: 1, size: 2 } } });
  });
  it('does nothing if the id is unknown', () => {
    const input = { files: { id: { state: 'started', received: 1, size: 2 } } };
    const result = stateReducer.reducers.PAUSE_DOWNLOAD(input, { id: 'differentid', paused: true });
    expect(result).toBe(input);
  });
  it('does nothing if the previous state is final', () => {
    const inputFinished = { files: { id: { state: 'finished', received: 1, size: 2 } } };
    const resultFinished = stateReducer.reducers.PAUSE_DOWNLOAD(inputFinished, { id: 'id', paused: true });
    expect(resultFinished).toBe(inputFinished);
    const inputFailed = { files: { id: { state: 'failed', received: 1, size: 2 } } };
    const resultFailed = stateReducer.reducers.PAUSE_DOWNLOAD(inputFailed, { id: 'id', paused: true });
    expect(resultFailed).toBe(inputFailed);
  });
});

describe('removeDownload', () => {
  it('removes the download', () => {
    const input = { files: { id: { state: 'finished' } } };
    const result = stateReducer.reducers.REMOVE_DOWNLOAD(input, { id: 'id' });
    expect(result).toEqual({ files: {} });
  });
  it('does nothing if the id is unknown', () => {
    const input = { files: { id: { state: 'finished' } } };
    const result = stateReducer.reducers.REMOVE_DOWNLOAD(input, { id: 'differentid' });
    expect(result).toBe(input);
  });
});

describe('setDownloadFilepath', () => {
  it('changes the download path', () => {
    const input = { files: { id: { state: 'started', localPath: 'oldpath' } } };
    const result = stateReducer.reducers.SET_DOWNLOAD_FILEPATH(input, { id: 'id', filePath: 'newpath' });
    expect(result).toEqual({ files: { id: { state: 'started', localPath: 'newpath' } } });
  });
  it('does nothing if the id is unknown', () => {
    const input = { files: { id: { state: 'finished', localPath: 'oldpath' } } };
    const result = stateReducer.reducers.SET_DOWNLOAD_FILEPATH(input, { id: 'differentid', filePath: 'newpath' });
    expect(result).toBe(input);
  });
});

describe('setDownloadHash', () => {
  it('changes the file hash', () => {
    const input = { files: { id: { state: 'finished', fileMD5: 'oldhash' } } };
    const result = stateReducer.reducers.SET_DOWNLOAD_HASH(input, { id: 'id', fileMD5: 'newhash' });
    expect(result).toEqual({ files: { id: { state: 'finished', fileMD5: 'newhash' } } });
  });
  it('does nothing if the id is unknown', () => {
    const input = { files: { id: { state: 'finished', fileMD5: 'oldhash' } } };
    const result = stateReducer.reducers.SET_DOWNLOAD_HASH(input, { id: 'differentid', fileMD5: 'newhash' });
    expect(result).toBe(input);
  });
});

describe('setDownloadHashByFile', () => {
  it('changes the file hash', () => {
    const input = { files: { id: { state: 'finished', localPath: 'path', fileMD5: 'oldhash' } } };
    const result = stateReducer.reducers.SET_DOWNLOAD_HASH_BY_FILE(input, { fileName: 'path', fileMD5: 'newhash' });
    expect(result).toEqual({ files: { id: { state: 'finished', localPath: 'path', fileMD5: 'newhash' } } });
  });
  it('does nothing if the name is unknown', () => {
    const input = { files: { id: { state: 'finished', localPath: 'path', fileMD5: 'oldhash' } } };
    const result = stateReducer.reducers.SET_DOWNLOAD_HASH_BY_FILE(input, { fileName: 'wrongpath', fileMD5: 'newhash' });
    expect(result).toBe(input);
  });
});

describe('startDownload', () => {
  it('sets the download state as started', () => {
    const input = { files: { id: { state: 'init' } } };
    const result = stateReducer.reducers.START_DOWNLOAD(input, { id: 'id' });
    expect(result.files.id.state).toEqual('started');
  });
  it('does nothing if the download is already finished', () => {
    const input = { files: { id: { state: 'finished' } } };
    const result = stateReducer.reducers.START_DOWNLOAD(input, { id: 'id' });
    expect(result).toBe(input);
  });
  it('does nothing if the download is paused', () => {
    const input = { files: { id: { state: 'paused' } } };
    const result = stateReducer.reducers.START_DOWNLOAD(input, { id: 'id' });
    expect(result).toBe(input);
  });
  it('does nothing if the id is unknown', () => {
    const input = { files: { id: { state: 'paused' } } };
    const result = stateReducer.reducers.START_DOWNLOAD(input, { id: 'differentid' });
    _.unset(result, ['startTime']);
    expect(result).toEqual(input);
  });
});

describe('setDownloadSpeed', () => {
  it('sets the download speed', () => {
    const input = { speed: 0 };
    const result = stateReducer.reducers.SET_DOWNLOAD_SPEED(input, 42);
    expect(result.speed).toEqual(42);
  });
});
