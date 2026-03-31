import { describe, it, expect, vi, beforeEach } from 'vitest';

const { winapiState } = vi.hoisted(() => {
  const winapiState = { error: undefined };
  return { winapiState };
});

vi.mock('winapi-bindings', () => ({
  ShellExecuteEx: () => {
    if (winapiState.error === undefined) {
      return;
    } else {
      throw new Error(winapiState.error);
    }
  },
  RegGetValue: () => ({
    type: 'REG_SZ',
    value: 'foobar',
  }),
  GetVolumePathName: (input) => {
    const path = require('path');
    const res = path.dirname(input);
    if (res === '/missing') {
      let err = new Error('fake error');
      err.code = 'ENOTFOUND';
      err.systemCode = 2;
      throw err;
    }
    return res;
  },
  __setError: (err) => { winapiState.error = err; },
}));

// In webpack, __non_webpack_require__ is the real Node.js require.
// In Jest (no webpack), we alias it to the normal require.
globalThis.__non_webpack_require__ = require;

let mockTmpFileCalls = 0;
let mockTmpFileReportError = undefined;
vi.mock('tmp', () => ({
  file: (opts, callback) => {
    if (mockTmpFileReportError) {
      return callback(new Error(mockTmpFileReportError));
    }
    mockTmpFileCalls += 1;
    callback(null, '/tmp/xyz', 42, () => undefined);
  },
}));

let mockWrites = [];
let mockWriteReportError = undefined;

vi.mock('fs', () => ({
    write: (fd, data, callback) => {
      if (mockWriteReportError) {
        callback(new Error(mockWriteReportError));
        return;
      }
      mockWrites.push(data);
      callback(null, data.length, '');
    },
    closeSync: () => {},
    existsSync: () => {
      return true;
    },
    readFileSync: () => {
      return '';
    }
}));


import { runElevated } from '../util/elevated';
import * as winapiBindings from 'winapi-bindings';

function dummy() {
  console.log('DUMMY FUNCTION');
  return 1;
}

describe('runElevated', () => {
  beforeEach(() => {
    mockTmpFileCalls = 0;
    mockTmpFileReportError = undefined;
    mockWrites = [];
    mockWriteReportError = undefined;
    winapiState.error = undefined;
  });

  it('creates a temporary file', () => {
    return runElevated('ipcPath', dummy).then(() => {
      expect(mockTmpFileCalls).toBe(1);
    });
  });

  it('writes a function to the temp file', () => {
    return runElevated('ipcPath', dummy).then(() => {
      expect(mockWrites.length).toBe(1);
      expect(mockWrites[0]).toContain('let moduleRoot =');
      expect(mockWrites[0]).toContain('let main = function dummy');
      expect(mockWrites[0]).toContain('DUMMY FUNCTION');
    });
  });

  it('passes arguments', () => {
    return runElevated('ipcPath', dummy, {
      answer: 42,
      truth: true,
      str: 'string',
      array: [ 1, 2, 3 ]
    }, '/module/base')
    .then(() => {
      expect(mockWrites[0]).toContain('let answer = 42;');
      expect(mockWrites[0]).toContain('let truth = true;');
      expect(mockWrites[0]).toContain('let str = "string";');
      expect(mockWrites[0]).toContain('let array = [1,2,3];');
    });
  });

  it('handles tmp file errors', () => {
    mockTmpFileReportError = 'i haz error';
    return runElevated('ipcPath', dummy)
    .then(() => {
      expect.fail('expected error');
    })
    .catch((err) => {
      expect(err.message).toBe('i haz error');
    });
  });

  it('handles write errors', () => {
    mockWriteReportError = 'i haz error';
    return runElevated('ipcPath', dummy)
    .then(() => {
      expect.fail('expected error');
    })
    .catch((err) => {
      expect(err.message).toBe('i haz error');
    });
  });

  it('handles library errors', () => {
    winapiBindings.__setError('i haz error');
    return runElevated('ipcPath', dummy)
    .then(() => {
      expect.fail('expected error');
    })
    .catch((err) => {
      expect(err.message).toBe('i haz error');
    });
  });
});
