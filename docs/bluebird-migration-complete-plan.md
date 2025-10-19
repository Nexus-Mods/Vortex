# Complete Bluebird to Native Promise Migration Plan

## Executive Summary

This document provides a comprehensive plan for migrating the Vortex codebase from Bluebird Promises to native Node.js Promises. With Node 22 providing excellent Promise support, Bluebird is no longer necessary and can be removed to simplify dependencies and improve maintainability.

## Current Status

The automated portion of the migration has been completed:
- ✅ Migration tools created
- ✅ Automated script run across codebase
- ✅ Bluebird dependencies removed from package.json files
- ❌ Manual migration of complex methods still required
- ❌ Comprehensive testing pending

## Migration Tools

All migration tools are now available in the `tools/` directory:

1. **Automated Migration Script**: `tools/migrate-bluebird-to-native.js`
   - Removes Bluebird imports
   - Replaces direct method equivalents
   - Generates migration report

2. **Migration Helper Generator**: `tools/bluebird-migration-helper.js`
   - Creates `tools/bluebird-migration-helpers.ts` with replacement functions

3. **Dependency Removal Script**: `tools/remove-bluebird-deps.js`
   - Removes Bluebird dependencies from all package.json files

4. **Verification Script**: `tools/verify-bluebird-removal.js`
   - Verifies complete removal of Bluebird from codebase

## Package.json Scripts

The following scripts have been added to package.json for easy execution:

```bash
# Generate migration helper functions
yarn run migrate:bluebird:guide

# Generate usage report
yarn run migrate:bluebird:report

# Run automated migration
yarn run migrate:bluebird

# Verify Bluebird removal
yarn run verify:bluebird
```

## Detailed Migration Steps

### Phase 1: Preparation (Completed)

1. ✅ Created migration tools
2. ✅ Ran automated migration script
3. ✅ Removed Bluebird dependencies
4. ✅ Generated migration helper functions

### Phase 2: Manual Migration (In Progress)

This phase requires manual replacement of complex Bluebird methods. The following patterns need attention:

#### 1. Promise.map / Promise.mapSeries → promiseMap / promiseMapSeries

**Files with this pattern:**
- src/app/Application.ts
- src/extensions/diagnostics_files/util/loadVortexLogs.ts
- src/extensions/mod_management/eventHandlers.ts
- extensions/games/game-morrowind/loadorder.js
- extensions/games/game-x4foundations/index.js
- And 30+ more files

**Replacement:**
Use the `promiseMap()` and `promiseMapSeries()` helper functions from `tools/bluebird-migration-helpers.ts`.

#### 2. Promise.each → promiseEach

**Files with this pattern:**
- src/extensions/download_management/util/downloadDirectory.ts
- src/extensions/ini_prep/index.ts
- src/extensions/mod_management/InstallContext.ts
- src/extensions/mod_management/LinkingDeployment.ts
- src/extensions/mod_management/index.ts
- And 15+ more files

**Replacement:**
Use the `promiseEach()` helper function.

#### 3. Promise.reduce → promiseReduce

**Files with this pattern:**
- src/extensions/mod_management/listInstaller.tsx
- src/extensions/nexus_integration/util.ts
- extensions/games/game-bladeandsorcery/migrations.js
- extensions/games/game-x4foundations/index.js

**Replacement:**
Use the `promiseReduce()` helper function.

#### 4. Promise.filter → promiseFilter

**Files with this pattern:**
- src/extensions/mod_management/util/deploy.ts
- src/extensions/local-gamesettings/src/index.ts

**Replacement:**
Use the `promiseFilter()` helper function.

#### 5. Promise.props → promiseProps

**Files with this pattern:**
- (Several files need this replacement)

**Replacement:**
Use the `promiseProps()` helper function.

#### 6. Promise.delay → promiseDelay

**Files with this pattern:**
- src/app/SplashScreen.ts
- src/extensions/download_management/index.ts
- src/extensions/extension_manager/util.ts
- src/extensions/hardlink_activator/index.ts
- src/extensions/mod_management/InstallContext.ts
- src/extensions/nexus_integration/eventHandlers.ts

**Replacement:**
Use the `promiseDelay()` helper function or `setTimeout` wrapped in Promise.

#### 7. Promise.join → promiseJoin

**Files with this pattern:**
- src/extensions/mod_management/views/Settings.tsx

**Replacement:**
Use the `promiseJoin()` helper function.

#### 8. Promise.try → promiseTry

**Files with this pattern:**
- (Several files need this replacement)

**Replacement:**
Use the `promiseTry()` helper function.

#### 9. Promise.any / Promise.some → promiseAny / promiseSome

**Files with this pattern:**
- (Several files need this replacement)

**Replacement:**
Use the `promiseAny()` or `promiseSome()` helper functions, or native `Promise.any()` for Node 15+.

#### 10. Promise.promisify / Promise.promisifyAll

**Files with this pattern:**
- extensions/gamebryo-ba2-support/src/index.ts

**Replacement:**
Use `util.promisify()` from Node.js built-in utilities.

#### 11. Promise.cancel

**Files with this pattern:**
- src/controls/Icon.tsx

**Replacement:**
Implement custom cancellation pattern with flags.

### Phase 3: Testing and Validation

#### 1. Unit Testing
- Run all existing tests: `yarn test`
- Add new tests for custom implementations
- Verify no regressions in functionality

#### 2. Integration Testing
- Test core application functionality
- Verify extension compatibility
- Test critical user workflows

#### 3. Performance Testing
- Benchmark critical operations
- Compare performance with Bluebird version
- Optimize custom implementations if needed

#### 4. Manual Testing
- Test UI responsiveness
- Verify error handling
- Check edge cases

### Phase 4: Final Review

#### 1. Code Review
- Review all migrated code
- Ensure consistent patterns
- Verify proper error handling

#### 2. Documentation Updates
- Update any documentation referencing Bluebird
- Document new patterns and practices

#### 3. Final Verification
- Run verification script: `yarn run verify:bluebird`
- Ensure zero Bluebird usage
- Confirm all tests pass

## Migration Helper Functions

The `tools/bluebird-migration-helpers.ts` file contains replacement functions for all complex Bluebird methods:

1. `promiseMap()` - Replacement for `Promise.map()`
2. `promiseMapSeries()` - Replacement for `Promise.mapSeries()`
3. `promiseEach()` - Replacement for `Promise.each()`
4. `promiseFilter()` - Replacement for `Promise.filter()`
5. `promiseReduce()` - Replacement for `Promise.reduce()`
6. `promiseProps()` - Replacement for `Promise.props()`
7. `promiseAny()` - Replacement for `Promise.any()`
8. `promiseSome()` - Replacement for `Promise.some()`
9. `promiseJoin()` - Replacement for `Promise.join()`
10. `promiseTry()` - Replacement for `Promise.try()`
11. `promiseDelay()` - Replacement for `Promise.delay()`
12. `promiseTimeout()` - Replacement for `Promise.timeout()`

## Risk Mitigation

### 1. Behavioral Differences
- Some Bluebird methods have different behavior than native equivalents
- Comprehensive testing required to catch any differences

### 2. Performance Regressions
- Custom implementations may be slower than Bluebird in some cases
- Performance testing and optimization needed

### 3. Cancellation Complexity
- Loss of built-in cancellation may require complex custom implementation
- Careful migration of cancellation logic required

### 4. Error Handling Differences
- Bluebird and native Promise may handle errors differently
- Thorough error handling testing required

## Timeline and Resources

### Estimated Effort
- **Manual Migration**: 3-4 weeks (depending on team size)
- **Testing and Validation**: 2-3 weeks
- **Final Review and Optimization**: 1 week

### Recommended Team
- 2-3 developers for manual migration
- 1 QA engineer for testing
- 1 code reviewer for final validation

## Benefits of Migration

### 1. Simplified Dependencies
- Removal of external Bluebird dependency
- Reduced package size
- Fewer potential security vulnerabilities

### 2. Better Performance
- Native Promise optimizations in Node 22
- Reduced overhead from third-party library

### 3. Improved Maintainability
- Alignment with Node.js ecosystem standards
- Easier for new developers to understand
- No need to learn Bluebird-specific APIs

### 4. Future Compatibility
- Better alignment with future Node.js versions
- Access to new Promise features as they're added to Node.js

## Next Steps

1. **Assign Migration Tasks**: Distribute manual migration work among team members
2. **Create Migration Branch**: Work on a dedicated branch for the migration
3. **Implement Helper Functions**: Start replacing Bluebird methods with helper functions
4. **Run Tests**: Continuously run tests during migration
5. **Document Changes**: Keep track of changes and issues encountered
6. **Final Verification**: Run verification script to ensure complete removal

## Conclusion

The Bluebird to native Promise migration is a significant but beneficial undertaking for the Vortex codebase. With the tools and plan provided, the migration can be completed systematically with minimal risk to application functionality. The end result will be a more modern, maintainable, and performant codebase that takes full advantage of Node 22's native Promise capabilities.