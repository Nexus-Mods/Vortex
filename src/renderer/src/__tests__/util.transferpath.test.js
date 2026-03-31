import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

vi.mock('turbowalk', () => {
  let handlers = {};
  return {
    __esModule: true,
    default: (walkPath, cb) => {
      return new Promise((resolve, reject) => {
        if (handlers[walkPath] !== undefined) {
          handlers[walkPath]((err, files) => {
            if (err !== null) {
              reject(err);
            } else {
              cb(files);
              resolve();
            }
          });
        } else {
          cb([]);
          resolve();
        }
      });
    },
    __setPathHandler: (walkPath, handler) => {
      handlers[walkPath] = handler;
    },
  };
});

vi.mock('diskusage', () => {
  let checkResult = { '': { free: 42 } };
  return {
    check: (checkPath) => checkResult[checkPath] || checkResult[''],
    __setCheckResult: (checkPath, res) => { checkResult[checkPath] = res; },
  };
});

vi.mock('winapi-bindings', () => {
  const path = require('path');
  return {
    GetVolumePathName: (input) => {
      const res = path.dirname(input);
      if (res === '/missing') {
        let err = new Error('fake error');
        err.code = 'ENOTFOUND';
        err.systemCode = 2;
        throw err;
      }
      return res;
    },
    ShellExecuteEx: () => {},
    RegGetValue: () => ({ type: 'REG_SZ', value: 'foobar' }),
  };
});

import { testPathTransfer, transferPath } from '../util/transferPath';
import * as walk from 'turbowalk';
import * as du from 'diskusage';
import * as fs from '../util/fs';

const MB = 1024 * 1024;

const baseA = path.sep + 'drivea';
const baseB = path.sep + 'driveb';

vi.mock('../util/fs', () => {
  const path = require('path');
  let fakeFS = {};
  const Promise = require('bluebird');

  const insert = (filePath, info) => {
    const insertInner = (tgt, restPath) => {
      let name = restPath[0];
      if (restPath.length === 1) {
        tgt[name] = info;
      } else {
        if (tgt[name] === undefined) {
          tgt[name] = {};
        }
        insertInner(tgt[name], restPath.slice(1));
      }
    }
    insertInner(fakeFS, filePath.split(path.sep));
  };

  const get = (filePath) => {
    const getInner = (tgt, restPath) => {
      let name = restPath[0];
      if (restPath.length === 1) {
        return tgt[name];
      } else {
        if (tgt[name] === undefined) {
          let err = new Error('file not found');
          err.code = 'ENOENT';
          throw err;
        }
        return getInner(tgt[name], restPath.slice(1));
      }
    }

    return getInner(fakeFS, filePath.split(path.sep));
  }

  const del = (filePath) => {
    const delInner = (tgt, restPath) => {
      let name = restPath[0];
      if (restPath.length === 1) {
        delete tgt[name];
      } else {
        if (tgt[name] === undefined) {
          let err = new Error('file not found');
          err.code = 'ENOENT';
          throw err;
        }
        return delInner(tgt[name], restPath.slice(1));
      }
    }

    return delInner(fakeFS, filePath.split(path.sep));
  }

  return {
    insertMock: (filePath, info) => {
      insert(filePath, info);
    },
    getMock: () => fakeFS,
    resetMock: () => fakeFS = {},
    statAsync: (filePath) => {
      let dev = filePath.startsWith(path.sep + 'drivea') ? 1 : 2;
      return Promise.resolve({
        dev,
        ino: Math.floor(Math.random() * 1000000),
        isDirectory: filePath.indexOf('.') === -1,
        isFile: filePath.indexOf('.') !== -1,
        size: 0,
      });
    },
    ensureDirWritableAsync: vi.fn((dirPath) => {
      insert(dirPath, { });
      return Promise.resolve();
    }),
    mkdirsAsync: vi.fn(dirPath => {
      insert(dirPath, { });
      return Promise.resolve();
    }),
    copyAsync: vi.fn((source, dest) => {
      const info = get(source);
      if (info.fail !== undefined) {
        return Promise.reject(info.fail);
      }
      insert(dest, { ...info, type: 'copied' });
      return Promise.resolve();
    }),
    linkAsync: vi.fn((source, dest) => {
      const info = get(source);
      if (info.fail !== undefined) {
        return Promise.reject(info.fail);
      }
      insert(dest, { ...info, type: 'linked' });
      return Promise.resolve();
    }),
    rmdirAsync: vi.fn((dirPath) => {
      let info = get(dirPath);
      if (Object.keys(info).length > 0) {
        let error = new Error('not empty');
        error.path = dirPath;
        error.code = 'ENOTEMPTY';
        return Promise.reject(error);
      }
      del(dirPath);
      return Promise.resolve();
    }),
    removeAsync: vi.fn((filePath) => {
      del(filePath)
      return Promise.resolve();
    }),
    ensureDirAsync: vi.fn((dirPath) => {
      insert(dirPath, { });
      return Promise.resolve();
    }),
    readdirAsync: (dirPath) => {
      return Promise.resolve([]);
    },
    // __esModule: true,
  };
});

const describeOnWindows = process.platform === "win32" ? describe : describe.skip;

describeOnWindows('testPathTransfer', () => {
  beforeEach(() => {
    // required: 1000 mb
    walk.__setPathHandler(path.join(baseA, 'source'), (cb) => {
      cb(null, [
        { name: 'dummyfile1.dat', isDirectory: false, size: 500 * MB },
        { name: 'dummyfile2.dat', isDirectory: false, size: 500 * MB },
      ])
    });
  });
  it('reports success if there is enough space', async () => {
    du.__setCheckResult(baseB, { free: 2000 * MB });
    await expect(testPathTransfer(path.join(baseA, 'source'), path.join(baseB, 'destination'))).resolves.toBeUndefined();
  });
  it('reports success if on same drive, independent of free size', async () => {
    // available: 1 mb
    du.__setCheckResult(baseA, { free: 1 * MB });
    await expect(testPathTransfer(path.join(baseA, 'source'), path.join(baseA, 'destination'))).resolves.toBeUndefined();
  });
  it('fails if there is less than 512 MB free', async () => {
    du.__setCheckResult(baseB, { free: 256 * MB });
    await expect(testPathTransfer(path.join(baseA, 'source'), path.join(baseB, 'destination'))).rejects.toThrow(`The partition "${path.sep}driveb" has insufficient space.`);
  });
});

const dummyA = path.join(baseA, 'source', 'dummyfile1.dat');
const dummyB = path.join(baseA, 'source', 'dummyfile2.dat');

describe('transferPath', () => {
  beforeEach(() => {
    fs.resetMock();
    fs.insertMock(dummyA, { name: 'dummyA' });
    fs.insertMock(dummyB, { name: 'dummyB' });
    // required: 1000 mb
    walk.__setPathHandler(path.join(baseA, 'source'), (cb) => {
      cb(null, [
        { name: 'dummyfile1.dat', filePath: dummyA, isDirectory: false, size: 500 * MB },
        { name: 'dummyfile2.dat', filePath: dummyB, isDirectory: false, size: 500 * MB },
      ])
    });
  });

  it('transfers all files with copy between drives', async () => {
    await expect(transferPath(path.join(baseA, 'source'), path.join(baseB, 'destination'), () => undefined)).resolves.toBeUndefined();
    expect(fs.getMock()).toEqual({
      '': {
        drivea: {},
        driveb: {
          destination: {
            'dummyfile1.dat': { name: 'dummyA', type: 'copied' },
            'dummyfile2.dat': { name: 'dummyB', type: 'copied' },
          },
        },
      },
    });
  });
  it('transfers all files with link on the same drive', async () => {
    await expect(transferPath(path.join(baseA, 'source'), path.join(baseA, 'destination'), () => undefined)).resolves.toBeUndefined();
    expect(fs.getMock()).toEqual({
      '': {
        drivea: {
          destination: {
            'dummyfile1.dat': { name: 'dummyA', type: 'linked' },
            'dummyfile2.dat': { name: 'dummyB', type: 'linked' },
          },
        },
      },
    });
  });
  it('creates required directories', async () => {
    const filePath = path.join(baseA, 'source', 'subdir', 'dummyfile1.dat');
    walk.__setPathHandler(path.join(baseA, 'source'), (cb) => {
      cb(null, [
        { name: 'subdir', filePath: path.join(baseA, 'source', 'subdir'), isDirectory: true, size: 0 },
        { name: 'dummyfile1.dat', filePath, isDirectory: false, size: 500 * MB },
      ])
    });
    fs.resetMock();
    fs.insertMock(filePath, { name: 'dummyA' });
    await transferPath(path.join(baseA, 'source'), path.join(baseB, 'destination'), () => undefined);
    expect(fs.getMock()).toEqual({
      '': {
        drivea: {},
        driveb: {
          destination: {
            subdir: {
              'dummyfile1.dat': { name: 'dummyA', type: 'copied' },
            },
          },
        },
      },
    });
  });
});
