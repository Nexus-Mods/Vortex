# Bluebird to Native Promise Migration Plan

## Overview

This document outlines the migration plan for transitioning the Vortex codebase from Bluebird Promises to native Node.js Promises. With Node 22 providing excellent Promise support, Bluebird is no longer necessary and can be removed to simplify dependencies and improve maintainability.

## Current State Analysis

### Bluebird Usage Statistics

Based on our analysis, Bluebird is used in approximately 324 files throughout the Vortex codebase. The usage includes:

1. **Import Statements**: Direct imports of Bluebird as `Promise`, `Bluebird`, or `PromiseBB`
2. **Bluebird-specific Methods**: Methods that don't exist in native Promise
3. **Configuration**: `Promise.config()` calls for cancellation and other features
4. **Promisification**: `Promise.promisify()` and `Promise.promisifyAll()` usage

### Bluebird-specific Methods Requiring Attention

The following Bluebird-specific methods need special handling during migration:

- `Promise.map` / `Promise.mapSeries`
- `Promise.each`
- `Promise.filter`
- `Promise.reduce`
- `Promise.props`
- `Promise.some` / `Promise.any`
- `Promise.join`
- `Promise.try`
- `Promise.delay` / `Promise.timeout`
- `Promise.promisify` / `Promise.promisifyAll`
- `Promise.cancel` (cancellation support)

## Migration Strategy

### Phase 1: Preparation and Analysis

1. **Create Migration Tools** (Completed)
   - Migration script to automate simple replacements
   - Helper functions for complex method replacements
   - Usage reporting tool

2. **Generate Detailed Report** (Completed)
   - Identify all files using Bluebird
   - Categorize usage patterns
   - Prioritize files for migration

### Phase 2: Automated Migration

1. **Run Migration Script**
   ```bash
   yarn run migrate:bluebird
   ```

2. **What the Script Handles Automatically**
   - Removal of Bluebird import statements
   - Replacement of direct native equivalents
   - Removal of `Promise.config()` calls
   - Basic method replacements where possible

### Phase 3: Manual Migration

1. **Replace Bluebird-specific Methods**
   - Use helper functions provided in migration guide
   - Implement custom solutions where needed
   - Test thoroughly for behavioral differences

2. **Handle Cancellation**
   - Implement custom cancellation patterns
   - Update code that relies on `promise.cancel()`

3. **Update Type Definitions**
   - Remove `@types/bluebird` dependency
   - Update Promise type references

### Phase 4: Testing and Validation

1. **Unit Testing**
   - Run all existing tests
   - Add new tests for custom implementations

2. **Integration Testing**
   - Test core application functionality
   - Verify extension compatibility

3. **Performance Testing**
   - Compare performance with Bluebird version
   - Optimize custom implementations if needed

## Detailed Migration Guide

### 1. Import Statement Replacements

**Before:**
```typescript
import Promise from 'bluebird';
import Bluebird from 'bluebird';
import PromiseBB from 'bluebird';
```

**After:**
```typescript
// Remove import statements - using native Promise
```

### 2. Method Replacements

#### Promise.map → Promise.all + Array.map

**Before:**
```typescript
Promise.map(items, item => processItem(item));
```

**After:**
```typescript
Promise.all(items.map(item => processItem(item)));
```

#### Promise.mapSeries → async/await with for loop

**Before:**
```typescript
Promise.mapSeries(items, item => processItem(item));
```

**After:**
```typescript
const results = [];
for (const item of items) {
  results.push(await processItem(item));
}
return results;
```

#### Promise.each → async/await with for loop

**Before:**
```typescript
Promise.each(items, item => processItem(item));
```

**After:**
```typescript
for (const item of items) {
  await processItem(item);
}
return items;
```

#### Promise.reduce → async/await with for loop

**Before:**
```typescript
Promise.reduce(items, (acc, item) => processItem(acc, item), initialValue);
```

**After:**
```typescript
let accumulator = initialValue;
for (const item of items) {
  accumulator = await processItem(accumulator, item);
}
return accumulator;
```

#### Promise.props → Custom implementation

**Before:**
```typescript
Promise.props({
  a: promiseA,
  b: promiseB
});
```

**After:**
```typescript
const promiseProps = async (object) => {
  const keys = Object.keys(object);
  const values = await Promise.all(keys.map(key => object[key]));
  const result = {};
  keys.forEach((key, index) => {
    result[key] = values[index];
  });
  return result;
};

promiseProps({
  a: promiseA,
  b: promiseB
});
```

#### Promise.delay → setTimeout wrapper

**Before:**
```typescript
Promise.delay(1000);
```

**After:**
```typescript
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
await delay(1000);
```

#### Promise.promisify → util.promisify

**Before:**
```typescript
const readFileAsync = Promise.promisify(fs.readFile);
```

**After:**
```typescript
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
```

### 3. Configuration Removal

**Before:**
```typescript
Promise.config({
  cancellation: true,
  longStackTraces: false
});
```

**After:**
```typescript
// Remove configuration - implement custom cancellation if needed
```

### 4. Cancellation Handling

**Before:**
```typescript
const promise = Promise.delay(1000);
promise.cancel();
```

**After:**
```typescript
const createCancellablePromise = (executor) => {
  let cancelled = false;
  const promise = new Promise((resolve, reject) => {
    const wrappedReject = (error) => {
      if (!cancelled) reject(error);
    };
    executor(resolve, wrappedReject);
  });
  promise.cancel = () => {
    cancelled = true;
  };
  return promise;
};
```

## Migration Tools

### 1. Migration Script

Run the automated migration script:
```bash
yarn run migrate:bluebird
```

This script will:
- Remove Bluebird imports
- Replace direct method equivalents
- Remove configuration calls
- Generate a report of files requiring manual attention

### 2. Migration Helper

Generate the migration helper with replacement functions:
```bash
yarn run migrate:bluebird:guide
```

This creates a TypeScript file with helper functions for complex replacements.

### 3. Usage Report

Generate a detailed report of Bluebird usage:
```bash
yarn run migrate:bluebird:report
```

This shows:
- Files with Bluebird imports
- Files using Bluebird-specific methods
- Files with configuration calls

## Timeline and Milestones

### Week 1-2: Preparation
- Finalize migration tools
- Generate comprehensive usage report
- Create detailed migration plan for each file

### Week 3-4: Automated Migration
- Run automated migration script
- Review and validate changes
- Fix any issues with automated replacements

### Week 5-8: Manual Migration
- Replace Bluebird-specific methods
- Implement custom solutions
- Update type definitions

### Week 9-10: Testing and Validation
- Run all tests
- Performance testing
- Integration testing

### Week 11: Final Review
- Code review
- Documentation updates
- Remove Bluebird dependency

## Risk Mitigation

### Potential Issues

1. **Behavioral Differences**
   - Some Bluebird methods have different behavior than native equivalents
   - Thorough testing required

2. **Performance Regressions**
   - Custom implementations may be slower than Bluebird
   - Performance testing and optimization needed

3. **Cancellation Support**
   - Loss of built-in cancellation may require custom implementation
   - Careful migration of cancellation logic required

### Mitigation Strategies

1. **Comprehensive Testing**
   - Run all existing tests before and after migration
   - Add new tests for custom implementations
   - Manual testing of critical paths

2. **Performance Monitoring**
   - Benchmark critical operations before migration
   - Compare performance after migration
   - Optimize custom implementations as needed

3. **Gradual Migration**
   - Migrate in phases rather than all at once
   - Maintain compatibility during transition
   - Roll back if critical issues are found

## Success Criteria

1. **Zero Bluebird Dependencies**
   - All Bluebird imports removed
   - Bluebird dependency removed from package.json
   - No runtime errors related to missing Bluebird

2. **Functional Equivalence**
   - All existing functionality preserved
   - No regressions in application behavior
   - All tests pass

3. **Performance Parity**
   - No significant performance regressions
   - Comparable or improved performance in critical paths

4. **Maintainability**
   - Simplified codebase with fewer dependencies
   - Easier to understand and maintain Promise usage
   - Better alignment with Node.js ecosystem

## Next Steps

1. Run the usage report to get a complete picture of Bluebird usage
2. Begin automated migration with the migration script
3. Start manual migration of complex methods
4. Set up testing framework to validate changes