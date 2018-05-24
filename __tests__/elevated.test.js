jest.mock('ffi');
//jest.mock('bindings');
jest.mock('ref');

let mockTmpFileCalls = 0;
let mockTmpFileReportError = undefined;
jest.mock('tmp', () => ({
  file: (callback) => {
    if (mockTmpFileReportError) {
      return callback(mockTmpFileReportError);
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
        callback(mockWriteReportError);
        return;
      }
      mockWrites.push(data);
      callback(null, data.length, '');
    },
    existsSync: () => {
      return true;
    },
    readFileSync: () => {
      return '';
    }
}));


import runElevated from '../src/util/elevated';

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
    require('ffi').__setError(undefined);
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
      expect(mockWrites[0]).toContain('let baseDir =');
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
      expect(mockWrites[0]).toContain('let baseDir = \'/module/base\'');
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
      expect(err).toBe('i haz error');
    });
  });

  it('handles write errors', () => {
    mockWriteReportError = 'i haz error';
    return runElevated('ipcPath', dummy)
    .then(() => {
      fail('expected error');
    })
    .catch((err) => {
      expect(err).toBe('i haz error');
    });
  });

  it('handles library errors', () => {
    require('ffi').__setError('i haz error');
    return runElevated('ipcPath', dummy)
    .then(() => {
      fail('expected error');
    })
    .catch((err) => {
      expect(err).toBe('i haz error');
    });
  });
});
