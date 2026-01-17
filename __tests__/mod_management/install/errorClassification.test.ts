import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  isBrowserAssistantError,
  isFileInUse,
  isCritical,
  classifyError,
} from '../../../src/extensions/mod_management/install/errors/errorClassification';

describe('error classification', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    // Restore original platform after each test
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  describe('isBrowserAssistantError', () => {
    it('should return true for Browser Assistant error on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(isBrowserAssistantError('Error in Roaming\\Browser Assistant\\something')).toBe(true);
    });

    it('should return false for Browser Assistant error on non-Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(isBrowserAssistantError('Error in Roaming\\Browser Assistant\\something')).toBe(false);
    });

    it('should return false for unrelated errors', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(isBrowserAssistantError('Some other error')).toBe(false);
    });
  });

  describe('isFileInUse', () => {
    it('should detect "being used by another process" error', () => {
      expect(isFileInUse('The file is being used by another process')).toBe(true);
    });

    it('should detect "locked by another process" error', () => {
      expect(isFileInUse('File is locked by another process')).toBe(true);
    });

    it('should return false for unrelated errors', () => {
      expect(isFileInUse('File not found')).toBe(false);
      expect(isFileInUse('Permission denied')).toBe(false);
    });
  });

  describe('isCritical', () => {
    it('should detect "Unexpected end of archive" as critical', () => {
      expect(isCritical('Unexpected end of archive')).toBe(true);
    });

    it('should detect "ERROR: Data Error" as critical', () => {
      expect(isCritical('ERROR: Data Error in CRC')).toBe(true);
    });

    it('should detect "Cannot open the file as archive" as critical', () => {
      expect(isCritical('Cannot open the file as archive')).toBe(true);
    });

    it('should detect "Can not open the file as archive" as critical (legacy)', () => {
      expect(isCritical('Can not open the file as archive')).toBe(true);
    });

    it('should NOT treat file-in-use errors as critical', () => {
      expect(isCritical('The file is being used by another process')).toBe(false);
      expect(isCritical('File is locked by another process')).toBe(false);
    });

    it('should return false for unrelated errors', () => {
      expect(isCritical('Network timeout')).toBe(false);
      expect(isCritical('Permission denied')).toBe(false);
    });
  });

  describe('classifyError', () => {
    it('should classify Browser Assistant errors as ignorable on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(classifyError('Error in Roaming\\Browser Assistant\\file')).toBe('ignorable');
    });

    it('should classify file-in-use errors as retryable', () => {
      expect(classifyError('File is locked by another process')).toBe('retryable');
    });

    it('should classify archive errors as critical', () => {
      expect(classifyError('Unexpected end of archive')).toBe('critical');
      expect(classifyError('ERROR: Data Error')).toBe('critical');
      expect(classifyError('Cannot open the file as archive')).toBe('critical');
    });

    it('should default unknown errors to retryable', () => {
      expect(classifyError('Some unknown error')).toBe('retryable');
    });

    it('should prioritize Browser Assistant over file-in-use', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      // This is an edge case - if an error somehow contains both patterns
      // Browser Assistant should take priority as it's checked first
      expect(classifyError('Roaming\\Browser Assistant being used by another process')).toBe('ignorable');
    });
  });
});
