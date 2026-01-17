import { describe, it, expect } from '@jest/globals';
import {
  findDownloadByReferenceTag,
  getReadyDownloadId,
  getModsByPhase,
  filterDependencyRules,
} from '../../../src/extensions/mod_management/install/helpers';

// Mock the dependencies module
// The mock returns null so we can test the fallback tag/md5 matching logic
jest.mock('../../../src/extensions/mod_management/util/dependencies', () => ({
  findDownloadByRef: jest.fn(() => null),
}));

describe('install helpers', () => {
  describe('findDownloadByReferenceTag', () => {
    it('should return null for null reference', () => {
      const downloads = { 'dl1': { state: 'finished' } };
      expect(findDownloadByReferenceTag(downloads, null)).toBeNull();
    });

    it('should return null for undefined reference', () => {
      const downloads = { 'dl1': { state: 'finished' } };
      expect(findDownloadByReferenceTag(downloads, undefined)).toBeNull();
    });

    it('should find download by reference tag', () => {
      const downloads = {
        'dl1': { modInfo: { referenceTag: 'tag-123' }, state: 'finished' },
        'dl2': { modInfo: { referenceTag: 'tag-456' }, state: 'finished' },
      };
      expect(findDownloadByReferenceTag(downloads, { tag: 'tag-123' })).toBe('dl1');
    });

    it('should find download by md5Hint when tag is also provided', () => {
      const downloads = {
        'dl1': { fileMD5: 'abc123', state: 'finished' },
        'dl2': { fileMD5: 'def456', state: 'finished' },
      };
      // Note: md5Hint matching only happens if tag is provided (as fallback)
      expect(findDownloadByReferenceTag(downloads, { tag: 'nonexistent', md5Hint: 'def456' })).toBe('dl2');
    });

    it('should return null when tag is not provided', () => {
      const downloads = {
        'dl1': { fileMD5: 'abc123', state: 'finished' },
      };
      // Without a tag, the function returns null early
      expect(findDownloadByReferenceTag(downloads, { md5Hint: 'abc123' })).toBeNull();
    });

    it('should return null when no match found', () => {
      const downloads = {
        'dl1': { modInfo: { referenceTag: 'tag-123' }, state: 'finished' },
      };
      expect(findDownloadByReferenceTag(downloads, { tag: 'nonexistent' })).toBeNull();
    });
  });

  describe('getReadyDownloadId', () => {
    it('should return download id when download is finished and not being installed', () => {
      const downloads = {
        'dl1': { modInfo: { referenceTag: 'tag-123' }, state: 'finished' },
      };
      const hasActiveOrPending = jest.fn().mockReturnValue(false);

      expect(getReadyDownloadId(downloads, { tag: 'tag-123' }, hasActiveOrPending)).toBe('dl1');
    });

    it('should return null when download is not finished', () => {
      const downloads = {
        'dl1': { modInfo: { referenceTag: 'tag-123' }, state: 'downloading' },
      };
      const hasActiveOrPending = jest.fn().mockReturnValue(false);

      expect(getReadyDownloadId(downloads, { tag: 'tag-123' }, hasActiveOrPending)).toBeNull();
    });

    it('should return null when download has active/pending installation', () => {
      const downloads = {
        'dl1': { modInfo: { referenceTag: 'tag-123' }, state: 'finished' },
      };
      const hasActiveOrPending = jest.fn().mockReturnValue(true);

      expect(getReadyDownloadId(downloads, { tag: 'tag-123' }, hasActiveOrPending)).toBeNull();
    });

    it('should return null when download not found', () => {
      const downloads = {};
      const hasActiveOrPending = jest.fn().mockReturnValue(false);

      expect(getReadyDownloadId(downloads, { tag: 'tag-123' }, hasActiveOrPending)).toBeNull();
    });
  });

  describe('getModsByPhase', () => {
    it('should filter mods by phase number', () => {
      const mods = [
        { id: 'mod1', phase: 0 },
        { id: 'mod2', phase: 1 },
        { id: 'mod3', phase: 0 },
        { id: 'mod4', phase: 2 },
      ];

      expect(getModsByPhase(mods, 0)).toEqual([
        { id: 'mod1', phase: 0 },
        { id: 'mod3', phase: 0 },
      ]);
      expect(getModsByPhase(mods, 1)).toEqual([{ id: 'mod2', phase: 1 }]);
      expect(getModsByPhase(mods, 2)).toEqual([{ id: 'mod4', phase: 2 }]);
    });

    it('should treat undefined phase as 0', () => {
      const mods = [
        { id: 'mod1' },  // no phase property
        { id: 'mod2', phase: 0 },
        { id: 'mod3', phase: 1 },
      ];

      expect(getModsByPhase(mods, 0)).toEqual([
        { id: 'mod1' },
        { id: 'mod2', phase: 0 },
      ]);
    });

    it('should return empty array when no mods match phase', () => {
      const mods = [
        { id: 'mod1', phase: 0 },
        { id: 'mod2', phase: 1 },
      ];

      expect(getModsByPhase(mods, 5)).toEqual([]);
    });
  });

  describe('filterDependencyRules', () => {
    it('should filter to only requires and recommends rules', () => {
      const rules = [
        { type: 'requires', reference: { id: 'mod1' } },
        { type: 'recommends', reference: { id: 'mod2' } },
        { type: 'conflicts', reference: { id: 'mod3' } },
        { type: 'provides', reference: { id: 'mod4' } },
      ] as any[];

      const filtered = filterDependencyRules(rules);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].type).toBe('requires');
      expect(filtered[1].type).toBe('recommends');
    });

    it('should exclude ignored rules', () => {
      const rules = [
        { type: 'requires', reference: { id: 'mod1' }, ignored: false },
        { type: 'requires', reference: { id: 'mod2' }, ignored: true },
        { type: 'recommends', reference: { id: 'mod3' } },
      ] as any[];

      const filtered = filterDependencyRules(rules);
      expect(filtered).toHaveLength(2);
      expect(filtered.find((r: any) => r.reference.id === 'mod2')).toBeUndefined();
    });

    it('should handle null/undefined rules', () => {
      expect(filterDependencyRules(null as any)).toEqual([]);
      expect(filterDependencyRules(undefined as any)).toEqual([]);
    });

    it('should handle empty array', () => {
      expect(filterDependencyRules([])).toEqual([]);
    });
  });
});
