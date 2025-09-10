import * as util from '../src/util/util';

describe('toPromise', () => {
  it('resolves with correct value when no error occurs', () => {
    const testFunc = (cb) => {
      cb(null, 'success');
    };
    
    return util.toPromise(testFunc).then(result => {
      expect(result).toBe('success');
    });
  });

  it('rejects with Error object when Error is passed', () => {
    const testError = new Error('test error');
    const testFunc = (cb) => {
      cb(testError, null);
    };
    
    return util.toPromise(testFunc).catch(err => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('test error');
    });
  });

  it('rejects with Error object when string is passed', () => {
    const testFunc = (cb) => {
      cb('error string', null);
    };
    
    return util.toPromise(testFunc).catch(err => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('error string');
    });
  });

  it('rejects with Error object when number is passed', () => {
    const testFunc = (cb) => {
      cb(42, null);
    };
    
    return util.toPromise(testFunc).catch(err => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Error code: 42');
      expect(err.code).toBe(42);
    });
  });

  it('rejects with Error object when object is passed', () => {
    const testObj = { code: 'CUSTOM_ERROR', message: 'custom error' };
    const testFunc = (cb) => {
      cb(testObj, null);
    };
    
    return util.toPromise(testFunc).catch(err => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Unknown error: {"code":"CUSTOM_ERROR","message":"custom error"}');
    });
  });
});