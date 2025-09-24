'use strict';

const fs = require('fs');
const path = require('path');
const { diff, patch } = require('../bsdiff-macos');

// Mock child_process.exec to avoid actually calling system commands
jest.mock('child_process', () => {
  return {
    exec: jest.fn((command, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
      }
      // Simulate successful execution
      callback(null, { stdout: '', stderr: '' });
    }),
    promisify: (fn) => fn
  };
});

describe('bsdiff-macos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('diff', () => {
    it('should call bsdiff command with correct arguments', async () => {
      const exec = require('child_process').exec;
      
      const oldFile = '/path/to/old/file';
      const newFile = '/path/to/new/file';
      const patchFile = '/path/to/patch/file';
      
      await diff(oldFile, newFile, patchFile);
      
      expect(exec).toHaveBeenCalledWith(
        `bsdiff "${oldFile}" "${newFile}" "${patchFile}"`,
        { timeout: 30000 },
        expect.any(Function)
      );
    });

    it('should throw error when file paths are missing', async () => {
      await expect(diff(null, '/path/to/new/file', '/path/to/patch/file'))
        .rejects.toThrow('All file paths must be provided');
    });
  });

  describe('patch', () => {
    it('should call bspatch command with correct arguments', async () => {
      const exec = require('child_process').exec;
      
      const oldFile = '/path/to/old/file';
      const newFile = '/path/to/new/file';
      const patchFile = '/path/to/patch/file';
      
      await patch(oldFile, newFile, patchFile);
      
      expect(exec).toHaveBeenCalledWith(
        `bspatch "${oldFile}" "${newFile}" "${patchFile}"`,
        { timeout: 30000 },
        expect.any(Function)
      );
    });

    it('should throw error when file paths are missing', async () => {
      await expect(patch(null, '/path/to/new/file', '/path/to/patch/file'))
        .rejects.toThrow('All file paths must be provided');
    });
  });
});