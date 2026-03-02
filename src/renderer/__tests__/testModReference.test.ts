/**
 * Comprehensive test suite for testModReference function and its helper functions.
 * 
 * Tests cover various matching scenarios using real mod data extracted from startup.json:
 * - ID-based matching (exact mod IDs, ID-only references)
 * - MD5 hash matching (exact hashes, fuzzy version handling)
 * - Repository matching (Nexus repository details, mod/file IDs)
 * - Logical filename matching (exact names, additional names, custom names)
 * - File expression matching (exact matches, glob patterns, wildcards)
 * - Version matching (exact versions, wildcards, semver ranges, non-semantic versions)
 * - Game ID matching (supported games, unsupported games)
 * - Reference tag matching (exact tags, fallback to other identifiers)
 * - Complex scenarios (multiple criteria, edge cases)
 * - Installer choices and patches matching
 * - Nullish values and unexpected types edge cases (error handling, type validation)
 * - Helper function testing (isFuzzyVersion, sanitizeExpression, coerceToSemver)
 * This test suite provides comprehensive coverage of the mod reference matching logic
 * used throughout Vortex for mod dependency resolution and mod identification, including
 * robustness testing for invalid inputs and edge cases.
 */

import { testModReference, isFuzzyVersion, sanitizeExpression, coerceToSemver } from '../extensions/mod_management/util/testModReference';
import { IMod, IModReference } from '../extensions/mod_management/types/IMod';

// Mock the log function to avoid console output during tests
jest.mock('../util/log', () => ({
  log: jest.fn(),
}));

describe('testModReference', () => {
  // Helper function to create a proper IMod object
  const createMod = (id: string, attributes: any): IMod => ({
    id,
    state: 'installed',
    type: '',
    installationPath: `mods/${id}`,
    attributes
  });

  // Sample mod data extracted from startup.json
  const sampleMods = {
    skyrimse: {
      'Tweaks for TTW 1.71-77934-1-71-1739639832': createMod('Tweaks for TTW 1.71-77934-1-71-1739639832', {
        fileMD5: '5f8a7b2c9d3e1f4a6b8c0d2e5f7a9b1c',
        fileName: 'Tweaks for TTW 1.71-77934-1-71-1739639832.7z',
        name: 'Tweaks for TTW 1.71',
        version: '1.71',
        logicalFileName: 'Tweaks for TTW 1.71.7z',
        fileSizeBytes: 1024000,
        modId: '77934',
        fileId: '12345',
        source: 'nexus',
        game: ['skyrimse'],
      }),
      'Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488': createMod('Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488', {
        fileMD5: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
        fileName: 'Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488.7z',
        name: 'Actor Limit Fix - Anniversary Edition',
        version: '9',
        logicalFileName: 'Actor Limit Fix AE.7z',
        fileSizeBytes: 2048000,
        modId: '32349',
        fileId: '67890',
        source: 'nexus',
        game: ['skyrimse'],
      }),
      'Adamant - Bard Perks Addon-30191-1-1-1-1702323805': createMod('Adamant - Bard Perks Addon-30191-1-1-1-1702323805', {
        fileMD5: '9f8e7d6c5b4a3928374658392847562',
        fileName: 'Adamant - Bard Perks Addon-30191-1-1-1-1702323805.zip',
        name: 'Adamant - Bard Perks Addon',
        version: '1.1.1',
        logicalFileName: 'Adamant Bard Perks.zip',
        fileSizeBytes: 512000,
        modId: '30191',
        fileId: '11111',
        source: 'nexus',
        game: ['skyrimse'],
        referenceTag: 'adamant-bard-v1.1.1',
      }),
      'Animation Motion Revolution-50258-1-5-3-1664395662': createMod('Animation Motion Revolution-50258-1-5-3-1664395662', {
        fileMD5: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
        fileName: 'Animation Motion Revolution-50258-1-5-3-1664395662.rar',
        name: 'Animation Motion Revolution',
        version: '1.5.3',
        logicalFileName: 'AMR.rar',
        fileSizeBytes: 4096000,
        modId: '50258',
        fileId: '22222',
        source: 'nexus',
        game: ['skyrimse'],
        additionalLogicalFileNames: ['AnimMotionRev.rar', 'AMR_Full.rar'],
      }),
      'BSA Version-68139-3-0-1685378500': createMod('BSA Version-68139-3-0-1685378500', {
        fileMD5: '8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f',
        fileName: 'BSA Version-68139-3-0-1685378500.zip',
        name: 'BSA Version',
        version: '3.0',
        logicalFileName: 'BSA_Version.zip',
        fileSizeBytes: 256000,
        modId: '68139',
        fileId: '33333',
        source: 'nexus',
        game: ['skyrimse'],
        installerChoices: {
          choice1: 'option1',
          choice2: 'option2'
        },
        patches: {
          patch1: 'value1',
          patch2: 'value2'
        }
      })
    }
  };

  describe('ID-based matching', () => {
    it('should match by exact mod ID', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        id: 'Tweaks for TTW 1.71-77934-1-71-1739639832'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should fail when ID does not match', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        id: 'different-mod-id'
      };

      expect(testModReference(mod, reference)).toBe(false);
    });

    it('should handle ID-only references', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        id: 'Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488',
        archiveId: 'some-archive-id' // This should be ignored for ID-only refs
      };

      expect(testModReference(mod, reference)).toBe(true);
    });
  });

  describe('MD5 hash matching', () => {
    it('should match by exact MD5 hash', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        fileMD5: '5f8a7b2c9d3e1f4a6b8c0d2e5f7a9b1c'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should fail when MD5 hash does not match', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        fileMD5: 'different-hash'
      };

      expect(testModReference(mod, reference)).toBe(false);
    });

    it('should fail MD5 mismatch even for fuzzy version matches when MD5 is specified', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        fileMD5: 'different-hash',
        versionMatch: '>=1.0.0', // This makes it fuzzy
        logicalFileName: 'Tweaks for TTW 1.71.7z' // Need another identifier
      };

      expect(testModReference(mod, reference)).toBe(false);
    });
  });

  describe('Repository matching', () => {
    it('should match by repository details', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        repo: {
          repository: 'nexus',
          modId: '32349',
          fileId: '67890'
        }
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should fail when repository does not match', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        repo: {
          repository: 'different-repo',
          modId: '32349',
          fileId: '67890'
        }
      };

      expect(testModReference(mod, reference)).toBe(false);
    });

    it('should fail when mod ID does not match', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        repo: {
          repository: 'nexus',
          modId: '99999',
          fileId: '67890'
        }
      };

      expect(testModReference(mod, reference)).toBe(false);
    });

    it('should fail when file ID does not match for non-fuzzy version', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        repo: {
          repository: 'nexus',
          modId: '32349',
          fileId: '99999' // Different file ID
        }
        // No fuzzy version, so file ID must match exactly
      };

      expect(testModReference(mod, reference)).toBe(false);
    });
  });

  describe('Logical filename matching', () => {
    it('should match by exact logical filename', () => {
      const mod = sampleMods.skyrimse['Adamant - Bard Perks Addon-30191-1-1-1-1702323805'];
      const reference: IModReference = {
        logicalFileName: 'Adamant Bard Perks.zip'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match additional logical filenames', () => {
      const mod = sampleMods.skyrimse['Animation Motion Revolution-50258-1-5-3-1664395662'];
      const reference: IModReference = {
        logicalFileName: 'AnimMotionRev.rar'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match another additional logical filename', () => {
      const mod = sampleMods.skyrimse['Animation Motion Revolution-50258-1-5-3-1664395662'];
      const reference: IModReference = {
        logicalFileName: 'AMR_Full.rar'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should fail when logical filename does not match', () => {
      const mod = sampleMods.skyrimse['Adamant - Bard Perks Addon-30191-1-1-1-1702323805'];
      const reference: IModReference = {
        logicalFileName: 'NonExistent.zip'
      };

      expect(testModReference(mod, reference)).toBe(false);
    });
  });

  describe('File expression matching', () => {
    it('should match by exact file expression against sanitized filename', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        fileExpression: 'Tweaks for TTW 1.71-77934-1-71-1739639832' // This should match the sanitized filename
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match file expression with glob pattern', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        fileExpression: 'Actor Limit Fix*'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match file expression with question mark wildcard', () => {
      const mod = sampleMods.skyrimse['Adamant - Bard Perks Addon-30191-1-1-1-1702323805'];
      const reference: IModReference = {
        fileExpression: 'Adamant - Bard Perks Addon-30191-?-?-?-*'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should fail when file expression does not match', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        fileExpression: 'Completely Different Name*'
      };

      expect(testModReference(mod, reference)).toBe(false);
    });
  });

  describe('Version matching', () => {
    it('should match exact version', () => {
      const mod = sampleMods.skyrimse['Adamant - Bard Perks Addon-30191-1-1-1-1702323805'];
      const reference: IModReference = {
        versionMatch: '1.1.1',
        logicalFileName: 'Adamant Bard Perks.zip' // Need identifier
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match wildcard version', () => {
      const mod = sampleMods.skyrimse['Animation Motion Revolution-50258-1-5-3-1664395662'];
      const reference: IModReference = {
        versionMatch: '*',
        logicalFileName: 'AMR.rar'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match semver range', () => {
      const mod = sampleMods.skyrimse['Animation Motion Revolution-50258-1-5-3-1664395662'];
      const reference: IModReference = {
        versionMatch: '>=1.5.0',
        logicalFileName: 'AMR.rar'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should fail when version does not satisfy range', () => {
      const mod = sampleMods.skyrimse['Animation Motion Revolution-50258-1-5-3-1664395662'];
      const reference: IModReference = {
        versionMatch: '>=2.0.0',
        logicalFileName: 'AMR.rar'
      };

      expect(testModReference(mod, reference)).toBe(false);
    });

    it('should handle non-semver versions with exact match', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        versionMatch: '9',
        logicalFileName: 'Actor Limit Fix AE.7z'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });
  });

  describe('Game ID matching', () => {
    it('should match when game ID is in supported games list', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        gameId: 'skyrimse',
        fileMD5: '5f8a7b2c9d3e1f4a6b8c0d2e5f7a9b1c'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should fail when game ID is not supported', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {
        gameId: 'fallout4',
        logicalFileName: 'Tweaks for TTW 1.71.7z',
        versionMatch: '>=1.0.0'
      };

      expect(testModReference(mod, reference)).toBe(false);
    });
  });

  describe('Reference tag matching', () => {
    it('should match by reference tag', () => {
      const mod = sampleMods.skyrimse['Adamant - Bard Perks Addon-30191-1-1-1-1702323805'];
      const reference: IModReference = {
        tag: 'adamant-bard-v1.1.1'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match when tag does not match but has ID identifier', () => {
      const mod = sampleMods.skyrimse['Adamant - Bard Perks Addon-30191-1-1-1-1702323805'];
      const reference: IModReference = {
        tag: 'different-tag',
        id: 'Adamant - Bard Perks Addon-30191-1-1-1-1702323805' // ID match should succeed despite tag mismatch
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should continue checking other identifiers when tag does not match', () => {
      const mod = sampleMods.skyrimse['Adamant - Bard Perks Addon-30191-1-1-1-1702323805'];
      const reference: IModReference = {
        tag: 'different-tag',
        fileMD5: '9f8e7d6c5b4a3928374658392847562' // This should match
      };

      expect(testModReference(mod, reference)).toBe(true);
    });
  });

  describe('Complex matching scenarios', () => {
    it('should match with multiple criteria', () => {
      const mod = sampleMods.skyrimse['Animation Motion Revolution-50258-1-5-3-1664395662'];
      const reference: IModReference = {
        logicalFileName: 'AMR.rar',
        versionMatch: '1.5.3',
        gameId: 'skyrimse',
        repo: {
          repository: 'nexus',
          modId: '50258',
          fileId: '22222'
        }
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match with multiple criteria even when one optional criterion matches', () => {
      const mod = sampleMods.skyrimse['Animation Motion Revolution-50258-1-5-3-1664395662'];
      const reference: IModReference = {
        logicalFileName: 'AMR.rar', // This matches
        versionMatch: '1.5.3',     // This matches
        gameId: 'skyrimse',        // This matches
        repo: {
          repository: 'nexus',
          modId: '50258',
          fileId: '22222'
        }
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should handle undefined mod gracefully', () => {
      const reference: IModReference = {
        id: 'any-id'
      };

      expect(testModReference(undefined as any, reference)).toBe(false);
    });

    it('should handle empty reference', () => {
      const mod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
      const reference: IModReference = {};
      expect(testModReference(mod, reference)).toBe(false);
    });
  });

  describe('Installer choices and patches matching', () => {
    it('should match when installer choices and patches are identical', () => {
      const mod = sampleMods.skyrimse['BSA Version-68139-3-0-1685378500'];
      const reference: IModReference = {
        logicalFileName: 'BSA_Version.zip',
        installerChoices: {
          choice1: 'option1',
          choice2: 'option2'
        },
        patches: {
          patch1: 'value1',
          patch2: 'value2'
        }
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should fail when installer choices do not match', () => {
      const mod = sampleMods.skyrimse['BSA Version-68139-3-0-1685378500'];
      const reference: IModReference = {
        logicalFileName: 'BSA_Version.zip',
        installerChoices: {
          choice1: 'different_option',
          choice2: 'option2'
        },
        patches: {
          patch1: 'value1',
          patch2: 'value2'
        }
      };

      expect(testModReference(mod, reference)).toBe(false);
    });

    it('should match when patches are identical with matching tag', () => {
      const mod = sampleMods.skyrimse['BSA Version-68139-3-0-1685378500'];
      // Add referenceTag to match the tag requirement for patches
      if (mod.attributes) {
        mod.attributes.referenceTag = 'test-tag';
      }
      
      const reference: IModReference = {
        logicalFileName: 'BSA_Version.zip',
        patches: {
          patch1: 'value1',
          patch2: 'value2'
        },
        tag: 'test-tag'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });
  });

  describe('Edge cases and real-world scenarios', () => {
    it('should match by custom filename when logical filename differs', () => {
      const mod = sampleMods.skyrimse['Adamant - Bard Perks Addon-30191-1-1-1-1702323805'];
      if (mod.attributes) {
        mod.attributes.customFileName = 'Custom_Bard_Perks.zip';
      }
      
      const reference: IModReference = {
        logicalFileName: 'Custom_Bard_Perks.zip'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should handle version matching with prefer suffix', () => {
      const mod = sampleMods.skyrimse['Animation Motion Revolution-50258-1-5-3-1664395662'];
      const reference: IModReference = {
        logicalFileName: 'AMR.rar',
        versionMatch: '1.5.3+prefer'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match non-semantic version exactly', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        logicalFileName: 'Actor Limit Fix AE.7z',
        versionMatch: '9' // Exact match for non-semantic version
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should match non-semantic version with compatible semver range', () => {
      const mod = sampleMods.skyrimse['Actor Limit Fix - Anniversary Edition (1.6.629.0 and later)-32349-9-1678780488'];
      const reference: IModReference = {
        logicalFileName: 'Actor Limit Fix AE.7z',
        versionMatch: '>=8' // This actually succeeds because "9" gets coerced to "9.0.0" which satisfies >=8
      };

      expect(testModReference(mod, reference)).toBe(true);
    });

    it('should handle file expression with mod name when fileName is undefined', () => {
      const mod = createMod('test-mod-without-filename', {
        name: 'Test Expression Match',
        version: '1.0.0',
        fileMD5: 'test-hash',
        source: 'nexus',
        game: ['skyrimse']
      });
      // Remove fileName to test the fallback to name
      if (mod.attributes) {
        delete mod.attributes.fileName;
      }
      
      const reference: IModReference = {
        fileExpression: 'Test Expression Match'
      };

      expect(testModReference(mod, reference)).toBe(true);
    });
  });

  describe('Nullish values and unexpected types edge cases', () => {
    describe('Mod parameter edge cases', () => {
      it('should return false when mod is null', () => {
        const reference: IModReference = {
          id: 'test-id'
        };

        expect(testModReference(null as any, reference)).toBe(false);
      });

      it('should handle mod with null attributes', () => {
        const mod: IMod = {
          id: 'test-mod',
          state: 'installed',
          type: '',
          installationPath: 'mods/test-mod',
          attributes: null as any
        };
        const reference: IModReference = {
          id: 'test-mod'
        };

        // Should handle null attributes gracefully
        const result = testModReference(mod, reference);
        expect(typeof result).toBe('boolean');
      });

      it('should handle mod with missing attributes property', () => {
        const mod = {
          id: 'test-mod',
          state: 'installed',
          type: '',
          installationPath: 'mods/test-mod'
          // no attributes property
        } as IMod;
        const reference: IModReference = {
          id: 'test-mod'
        };

        // Should treat as IModLookupInfo and handle gracefully
        const result = testModReference(mod, reference);
        expect(typeof result).toBe('boolean');
      });

      it('should handle mod with empty attributes object', () => {
        const mod = createMod('test-mod', {});
        const reference: IModReference = {
          fileMD5: 'some-hash'
        };

        expect(testModReference(mod, reference)).toBe(false);
      });

      it('should handle mod as number type', () => {
        const reference: IModReference = {
          id: 'test-id'
        };

        expect(testModReference(123 as any, reference)).toBe(false);
      });

      it('should handle mod as string type', () => {
        const reference: IModReference = {
          id: 'test-id'
        };

        expect(testModReference('not-a-mod' as any, reference)).toBe(false);
      });

      it('should handle mod as boolean type', () => {
        const reference: IModReference = {
          id: 'test-id'
        };

        expect(testModReference(true as any, reference)).toBe(false);
      });

      it('should handle mod as array type', () => {
        const reference: IModReference = {
          id: 'test-id'
        };

        expect(testModReference([] as any, reference)).toBe(false);
      });
    });

    describe('Reference parameter edge cases', () => {
      const validMod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];

      it('should return false when reference is null', () => {
        expect(testModReference(validMod, null as any)).toBe(false);
      });

      it('should return false when reference is undefined', () => {
        expect(testModReference(validMod, undefined as any)).toBe(false);
      });

      it('should return false when reference is number type', () => {
        expect(testModReference(validMod, 123 as any)).toBe(false);
      });

      it('should return false when reference is string type', () => {
        expect(testModReference(validMod, 'not-a-reference' as any)).toBe(false);
      });

      it('should return false when reference is boolean type', () => {
        expect(testModReference(validMod, false as any)).toBe(false);
      });

      it('should return false when reference is array type', () => {
        expect(testModReference(validMod, [] as any)).toBe(false);
      });

      it('should handle reference with null properties', () => {
        const reference: IModReference = {
          id: null as any,
          fileMD5: null as any,
          versionMatch: null as any,
          logicalFileName: null as any
        };

        // Should handle null properties gracefully
        const result = testModReference(validMod, reference);
        expect(typeof result).toBe('boolean');
      });

      it('should handle reference with undefined properties', () => {
        const reference: IModReference = {
          id: undefined,
          fileMD5: undefined,
          versionMatch: undefined,
          logicalFileName: undefined
        };

        // Should handle undefined properties (which is normal)
        const result = testModReference(validMod, reference);
        expect(typeof result).toBe('boolean');
      });
    });

    describe('Helper function edge cases with nullish values', () => {
      it('should handle isFuzzyVersion with null input', () => {
        expect(isFuzzyVersion(null as any)).toBe(false);
      });

      it('should handle isFuzzyVersion with non-string types', () => {
        expect(isFuzzyVersion(123 as any)).toBe(false);
        expect(isFuzzyVersion(true as any)).toBe(false);
        expect(isFuzzyVersion({} as any)).toBe(false);
        expect(isFuzzyVersion([] as any)).toBe(false);
      });

      it('should return empty string when sanitizeExpression gets null input', () => {
        expect(sanitizeExpression(null as any)).toBe('');
      });

      it('should return empty string when sanitizeExpression gets undefined input', () => {
        expect(sanitizeExpression(undefined as any)).toBe('');
      });

      it('should return empty string when sanitizeExpression gets non-string types', () => {
        expect(sanitizeExpression(123 as any)).toBe('');
        expect(sanitizeExpression(true as any)).toBe('');
        expect(sanitizeExpression({} as any)).toBe('');
      });

      it('should handle coerceToSemver with null input', () => {
        expect(coerceToSemver(null as any)).toBeUndefined();
      });

      it('should handle coerceToSemver with undefined input', () => {
        expect(coerceToSemver(undefined as any)).toBeUndefined();
      });

      it('should handle coerceToSemver with non-string types', () => {
        expect(coerceToSemver(123 as any)).toBeUndefined();
        expect(coerceToSemver(true as any)).toBeUndefined();
        expect(coerceToSemver({} as any)).toBeUndefined();
        expect(coerceToSemver([] as any)).toBeUndefined();
      });
    });

    describe('Complex edge cases with mixed nullish values', () => {
      it('should return false when both mod and reference are null', () => {
        expect(testModReference(null as any, null as any)).toBe(false);
      });

      it('should handle both mod and reference as undefined', () => {
        expect(testModReference(undefined as any, undefined as any)).toBe(false);
      });

      it('should handle mod with corrupted attributes structure', () => {
        const corruptedMod = {
          id: 'test-mod',
          state: 'installed',
          type: '',
          installationPath: 'mods/test-mod',
          attributes: {
            // Simulating corrupted data that might come from storage
            version: { nested: 'object' }, // Should be string
            game: 'not-an-array', // Should be array
            fileMD5: 12345, // Should be string
            modId: null // Should be string
          }
        } as any;

        const reference: IModReference = {
          versionMatch: '1.0.0'
        };

        // Should handle corrupted data gracefully without throwing
        expect(() => testModReference(corruptedMod, reference)).not.toThrow();
      });

      it('should handle reference with corrupted repo structure', () => {
        const validMod = sampleMods.skyrimse['Tweaks for TTW 1.71-77934-1-71-1739639832'];
        const reference: IModReference = {
          repo: {
            repository: null as any,
            modId: undefined as any,
            fileId: 123 as any // Should be string
          } as any
        };

        // Should handle corrupted repo data gracefully
        expect(() => testModReference(validMod, reference)).not.toThrow();
      });
    });
  });

  describe('Helper functions', () => {
    describe('isFuzzyVersion', () => {
      it('should identify fuzzy version patterns', () => {
        // These patterns use the special +prefer suffix or wildcards
        expect(isFuzzyVersion('1.0.0+prefer')).toBe(true);
        expect(isFuzzyVersion('*')).toBe(true);
        // The function checks if semver.validRange() returns different from input
        // Most semver ranges are not considered "fuzzy" by this implementation
        // because they get coerced to exact versions first
        expect(isFuzzyVersion('1.x')).toBe(true);
        expect(isFuzzyVersion('1.2.x')).toBe(true);
      });

      it('should identify exact versions as not fuzzy', () => {
        expect(isFuzzyVersion('1.0.0')).toBe(false);
        expect(isFuzzyVersion('2.5.1')).toBe(false);
        expect(isFuzzyVersion('9')).toBe(false);
      });

      it('should identify special markers as fuzzy', () => {
        expect(isFuzzyVersion('1.0.0+prefer')).toBe(true);
        expect(isFuzzyVersion('*')).toBe(true);
      });

      it('should handle invalid input', () => {
        expect(isFuzzyVersion('')).toBe(false);
        expect(isFuzzyVersion(null as any)).toBe(false);
        expect(isFuzzyVersion(undefined as any)).toBe(false);
      });
    });

    describe('sanitizeExpression', () => {
      it('should remove file extension', () => {
        expect(sanitizeExpression('mod.zip')).toBe('mod');
        expect(sanitizeExpression('complex-mod-name.7z')).toBe('complex-mod-name');
      });

      it('should remove duplicate indicators', () => {
        expect(sanitizeExpression('mod.1.zip')).toBe('mod');
        expect(sanitizeExpression('mod (1).zip')).toBe('mod');
        expect(sanitizeExpression('mod.2.7z')).toBe('mod');
        expect(sanitizeExpression('mod (15).rar')).toBe('mod');
      });

      it('should handle complex filenames', () => {
        expect(sanitizeExpression('Animation Motion Revolution-50258-1-5-3-1664395662.rar'))
          .toBe('Animation Motion Revolution-50258-1-5-3-1664395662');
      });
    });

    describe('coerceToSemver', () => {
      it('should handle standard semver', () => {
        expect(coerceToSemver('1.2.3')).toBe('1.2.3');
        expect(coerceToSemver('2.0.1')).toBe('2.0.1');
      });

      it('should handle versions with pre-release', () => {
        expect(coerceToSemver('1.2.3-alpha')).toBe('1.2.3-alpha');
        expect(coerceToSemver('1.2.3.beta')).toBe('1.2.3-beta');
        expect(coerceToSemver('1.2.3+build')).toBe('1.2.3-build');
      });

      it('should handle partial versions', () => {
        expect(coerceToSemver('1.2')).toBe('1.2.0');
        expect(coerceToSemver('5')).toBe('5.0.0');
      });

      it('should handle invalid versions', () => {
        expect(coerceToSemver('not-a-version')).toBeUndefined();
        expect(coerceToSemver('')).toBeUndefined();
        // v1.2.3.4.5 matches the first part (v1.2.3) and the rest falls to semver.coerce
        // which returns just 1.2.3
        expect(coerceToSemver('v1.2.3.4.5')).toBe('1.2.3');
      });

      it('should handle versions with leading zeros', () => {
        // The current implementation doesn't strip leading zeros in the first regex match
        expect(coerceToSemver('01.02.03')).toBe('01.02.03');
        expect(coerceToSemver('1.00.0')).toBe('1.00.0');
        // But for coerceable versions, it does strip them
        expect(coerceToSemver('1.0')).toBe('1.0.0');
      });
    });
  });
});
