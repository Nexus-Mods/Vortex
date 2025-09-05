# Update Glob to Native Node.js File System Commands

## Overview

This document outlines the plan to replace all instances of the `glob` package with native Node.js file system commands throughout the Vortex codebase. The goal is to reduce dependencies, improve performance, and maintain consistency in file system operations.

Analysis of the Vortex codebase shows that it has already made significant progress in eliminating glob usage. Most file operations use native Node.js `fs` module functions, with only a few areas requiring attention to fully eliminate the dependency.

## Architecture

The approach will focus on replacing glob patterns with equivalent native Node.js file system operations:

1. **Pattern Matching**: Replace glob patterns like `**/*.js` with recursive directory traversal using `fs.readdir` and `fs.stat`
2. **Wildcard Expansion**: Implement custom functions to handle wildcard patterns like `*.ts` using native file system operations
3. **File Filtering**: Use native filtering mechanisms instead of glob's built-in filtering

## Current State Analysis

### Dependencies

1. **Direct Dependencies**:
   - The main Vortex project does not have `glob` as a direct dependency
   - The `nmm-import-tool` extension has `glob` as a dependency in its package.json but code analysis shows it's not actually used in the extension code

2. **Type Definitions**:
   - `@types/glob` is listed in devDependencies of the main project
   - Used in validation scripts (`postinstall.js` and `validate-clean-install.js`) for TypeScript type checking

3. **Pattern Usage**:
   - Several JSON configuration files use glob patterns in string form for build tools (these are configuration for external tools and don't require code changes)
   - Code in `BuildSubprojects.js` already implements custom pattern matching instead of using glob

### Existing Replacements

The codebase already demonstrates good practices in replacing glob:

1. **InstallAssets.js**: Completely removed glob dependency and implemented native file system operations
2. **BuildSubprojects.js**: Uses custom `getAllFiles` function with pattern matching instead of glob
3. **Validation Scripts**: Only reference @types/glob for TypeScript definitions

## Implementation Plan

### 1. Remove Unused Dependencies

```bash
# Remove glob from nmm-import-tool if not used
yarn remove glob
```

### 2. Replace Remaining Pattern Matching

#### In BuildSubprojects.js
The existing `getAllFiles` function already handles pattern matching, but can be enhanced:

```javascript
// Current implementation
const getAllFiles = (dir, patterns) => {
  const files = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...getAllFiles(fullPath, patterns));
      } else {
        // Check if file matches any pattern
        const relativePath = path.relative(basePath, fullPath);
        for (const pattern of patterns) {
          if (pattern.includes('**')) {
            // Simple wildcard matching for TypeScript files
            if (pattern.includes('*.ts') && fullPath.endsWith('.ts')) {
              files.push(fullPath);
              break;
            }
            if (pattern.includes('*.tsx') && fullPath.endsWith('.tsx')) {
              files.push(fullPath);
              break;
            }
          } else if (relativePath === pattern || item.name === pattern) {
            files.push(fullPath);
            break;
          }
        }
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be read
  }
  return files;
};
```

### 3. Enhance Pattern Matching Functions

Create a more robust pattern matching utility:

```javascript
function matchPattern(filePath, pattern) {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')      // Escape dots
    .replace(/\*/g, '.*')       // Convert * to .*
    .replace(/\/\*\*/g, '(?:/.*)?'); // Convert ** to optional subdirs
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

function findFiles(dir, pattern) {
  const results = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      
      if (item.isDirectory()) {
        walk(fullPath);
      } else if (item.isFile() && matchPattern(fullPath, pattern)) {
        results.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return results;
}
```

### 4. Update Validation Scripts

Since the validation scripts use `@types/glob` for TypeScript type checking and not for actual glob operations, we should keep the dependency but ensure it's properly used. The scripts already implement proper checking:

```javascript
// In postinstall.js and validate-clean-install.js
async function ensureTypesInstalled() {
  console.log('Ensuring TypeScript types are properly installed...');
  
  // Check if @types/glob is properly installed
  try {
    const globTypesPath = path.join(__dirname, 'node_modules', '@types', 'glob');
    await fs.stat(globTypesPath);
    const files = await fs.readdir(globTypesPath);
    if (files.length === 0) {
      console.log('@types/glob is empty, may need reinstallation');
    }
  } catch (err) {
    console.log('@types/glob is missing, may need installation');
  }
  
  // Check if @types/rimraf is properly installed
  try {
    const rimrafTypesPath = path.join(__dirname, 'node_modules', '@types', 'rimraf');
    await fs.stat(rimrafTypesPath);
    const files = await fs.readdir(rimrafTypesPath);
    if (files.length === 0) {
      console.log('@types/rimraf is empty, may need reinstallation');
    }
  } catch (err) {
    console.log('@types/rimraf is missing, may need installation');
  }
}
```

## Data Models & Utility Functions

### Pattern Matching Utility

Create a utility module for pattern matching:

```javascript
// src/util/patternMatcher.ts

export function matchPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')      // Escape dots
    .replace(/\*/g, '.*')       // Convert * to .*
    .replace(/\/\*\*/g, '(?:/.*)?'); // Convert ** to optional subdirs
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

export function findFiles(dir: string, pattern: string): string[] {
  const results: string[] = [];
  
  function walk(currentDir: string) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      
      if (item.isDirectory()) {
        walk(fullPath);
      } else if (item.isFile() && matchPattern(fullPath, pattern)) {
        results.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return results;
}
```

## Business Logic Layer

### File Operations Service

Create a service to handle all file system operations:

```javascript
// src/util/fileOperations.ts

import * as fs from 'fs';
import * as path from 'path';
import { matchPattern } from './patternMatcher';

export class FileOperationsService {
  static findFiles(dir: string, pattern: string): string[] {
    const results: string[] = [];
    
    function walk(currentDir: string) {
      try {
        const items = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(currentDir, item.name);
          
          if (item.isDirectory()) {
            walk(fullPath);
          } else if (item.isFile() && matchPattern(fullPath, pattern)) {
            results.push(fullPath);
          }
        }
      } catch (err) {
        // Handle permission errors or other issues
        console.warn(`Could not read directory: ${currentDir}`, err);
      }
    }
    
    walk(dir);
    return results;
  }
  
  static findFilesWithExtensions(dir: string, extensions: string[]): string[] {
    const results: string[] = [];
    
    function walk(currentDir: string) {
      try {
        const items = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(currentDir, item.name);
          
          if (item.isDirectory()) {
            walk(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(fullPath);
            if (extensions.includes(ext)) {
              results.push(fullPath);
            }
          }
        }
      } catch (err) {
        console.warn(`Could not read directory: ${currentDir}`, err);
      }
    }
    
    walk(dir);
    return results;
  }
}
```

## Testing

### Unit Tests for Pattern Matching

```javascript
// __tests__/util/patternMatcher.test.ts

import { matchPattern, findFiles } from '../../src/util/patternMatcher';
import * as fs from 'fs';
import * as path from 'path';

describe('Pattern Matching Utility', () => {
  test('matches simple file patterns', () => {
    expect(matchPattern('/path/to/file.ts', '*.ts')).toBe(true);
    expect(matchPattern('/path/to/file.js', '*.ts')).toBe(false);
  });
  
  test('matches recursive patterns', () => {
    expect(matchPattern('/src/components/Button.tsx', 'src/**/*.tsx')).toBe(true);
    expect(matchPattern('/src/utils/helper.ts', 'src/**/*.tsx')).toBe(false);
  });
  
  test('finds files with pattern', () => {
    // Mock file system for testing
    const mockFiles = [
      '/project/src/index.ts',
      '/project/src/components/Button.tsx',
      '/project/src/utils/helper.ts',
      '/project/dist/bundle.js'
    ];
    
    // Test would involve mocking fs.readdirSync and fs.statSync
    // Implementation details would depend on the specific testing framework setup
  });
});
```

## Migration Steps

### Phase 1: Dependency Cleanup
1. Verify that `nmm-import-tool` doesn't actually use the glob package in code
2. Remove unused `glob` dependency from `nmm-import-tool/package.json` if confirmed unused
3. Keep `@types/glob` in validation scripts as it's used for TypeScript type checking

### Phase 2: Code Enhancement
1. Enhance the existing pattern matching in `BuildSubprojects.js`
2. Create the utility functions for pattern matching
3. Replace any remaining glob-like functionality with native operations

### Phase 3: Testing and Validation
1. Run unit tests to ensure pattern matching works correctly
2. Test build processes to ensure no regressions
3. Validate that all file operations work as expected
4. Run the clean install validation script to ensure everything works correctly

## Benefits

1. **Reduced Dependencies**: Eliminate external glob package dependency from extensions
2. **Improved Performance**: Native Node.js operations can be more efficient
3. **Better Control**: Custom implementation allows for specific optimizations
4. **Consistency**: All file operations use the same approach
5. **Maintainability**: Fewer external dependencies to maintain

## Risks and Mitigations

### Risk: Pattern Matching Inconsistencies
- **Mitigation**: Comprehensive testing of pattern matching functions against known glob patterns

### Risk: Performance Degradation
- **Mitigation**: Benchmark file operations before and after changes

### Risk: Breaking Existing Functionality
- **Mitigation**: Thorough testing of build processes and file operations

### Risk: Removing Needed Dependencies
- **Mitigation**: Verify that dependencies are actually unused before removal

## Conclusion

The Vortex codebase is already well-positioned to minimize glob usage, with most file operations already using native Node.js functions. The main work involves removing the unused dependency in the `nmm-import-tool` extension and enhancing the existing custom pattern matching implementations to be more robust and feature-complete. The validation scripts appropriately use `@types/glob` for TypeScript type checking and should be maintained.