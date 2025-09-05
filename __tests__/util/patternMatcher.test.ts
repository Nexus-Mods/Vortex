import { matchPattern, findFiles, findFilesWithExtensions, globToRegex } from '../../src/util/patternMatcher';
import * as fs from 'fs';
import * as path from 'path';

// Mock file system for testing
jest.mock('fs');

describe('Pattern Matching Utility', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('converts glob pattern to regex correctly', () => {
    expect(globToRegex('*.ts')).toEqual(/^.*\.ts$/);
    expect(globToRegex('**/*.tsx')).toEqual(/^.*\/.*\.tsx$/);
    expect(globToRegex('src/**/*.js')).toEqual(/^src\/.*\/.*\.js$/);
  });

  test('matches simple file patterns', () => {
    expect(matchPattern('/path/to/file.ts', '*.ts')).toBe(true);
    expect(matchPattern('/path/to/file.js', '*.ts')).toBe(false);
  });

  test('matches recursive patterns', () => {
    expect(matchPattern('/src/components/Button.tsx', '**/*.tsx')).toBe(true);
    expect(matchPattern('/src/utils/helper.ts', '**/*.tsx')).toBe(false);
  });

  test('finds files with specific extensions', () => {
    // Mock the file system
    (fs.readdirSync as jest.Mock).mockImplementation((dirPath, options) => {
      if (dirPath === '/project') {
        return [
          { name: 'src', isDirectory: () => true, isFile: () => false },
          { name: 'dist', isDirectory: () => true, isFile: () => false },
          { name: 'package.json', isDirectory: () => false, isFile: () => true }
        ];
      } else if (dirPath === '/project/src') {
        return [
          { name: 'index.ts', isDirectory: () => false, isFile: () => true },
          { name: 'components', isDirectory: () => true, isFile: () => false }
        ];
      } else if (dirPath === '/project/src/components') {
        return [
          { name: 'Button.tsx', isDirectory: () => false, isFile: () => true },
          { name: 'Header.tsx', isDirectory: () => false, isFile: () => true }
        ];
      } else if (dirPath === '/project/dist') {
        return [
          { name: 'bundle.js', isDirectory: () => false, isFile: () => true }
        ];
      }
      return [];
    });

    const result = findFilesWithExtensions('/project', ['.ts', '.tsx']);
    expect(result).toContain('/project/src/index.ts');
    expect(result).toContain('/project/src/components/Button.tsx');
    expect(result).toContain('/project/src/components/Header.tsx');
    expect(result).not.toContain('/project/dist/bundle.js');
    expect(result).not.toContain('/project/package.json');
  });
});