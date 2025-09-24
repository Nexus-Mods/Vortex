'use strict';

const { Library } = require('../ffi-macos');

describe('ffi-macos', () => {
  describe('Library', () => {
    it('should create a library instance', () => {
      const lib = new Library('test', {});
      expect(lib).toBeInstanceOf(Library);
      expect(lib.name).toBe('test');
    });

    it('should call function and return mock result', (done) => {
      const lib = new Library('test', {
        testFunction: {}
      });

      lib.callFunction('testFunction', [], (err, result) => {
        expect(err).toBeNull();
        expect(result).toBe(42);
        done();
      });
    });

    it('should return error for non-existent function', (done) => {
      const lib = new Library('test', {});

      lib.callFunction('nonExistentFunction', [], (err, result) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain('Function nonExistentFunction not found');
        expect(result).toBeUndefined();
        done();
      });
    });
  });
});