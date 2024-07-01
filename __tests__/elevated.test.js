let mockTmpFileCalls = 0;
let mockTmpFileReportError = undefined;
jest.mock('tmp', () => ({
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

jest.mock('fs', () => ({
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


import runElevated from '../src/util/vortex-run/src/elevated';

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
      fail('expected error');
    })
    .catch((err) => {
      expect(err.message).toBe('i haz error');
    });
  });

  it('handles write errors', () => {
    mockWriteReportError = 'i haz error';
    return runElevated('ipcPath', dummy)
    .then(() => {
      fail('expected error');
    })
    .catch((err) => {
      expect(err.message).toBe('i haz error');
    });
  });

  it('handles library errors', () => {
    require('winapi-bindings').__setError('i haz error');
    return runElevated('ipcPath', dummy)
    .then(() => {
      fail('expected error');
    })
    .catch((err) => {
      expect(err.message).toBe('i haz error');
    });
  });
});
