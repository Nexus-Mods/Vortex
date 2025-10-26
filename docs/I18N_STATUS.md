# i18n Migration Status

**Last Updated:** 2025-10-26

## Current State

### Namespaces Configured
- ✅ `common` - In use (26 lines + actions section)
- ✅ `collection` - Configured (browse + pagination sections populated)
- ✅ `mod_management` - Configured (empty, ready for migration)
- ✅ `download_management` - Configured (empty, ready for migration)
- ✅ `profile_management` - Configured (empty, ready for migration)
- ✅ `nexus_integration` - Configured (empty, ready for migration)
- ✅ `gamemode_management` - Configured (empty, ready for migration)
- ✅ `extension_manager` - Configured (empty, ready for migration)

### Migration Progress

**Completed:** 1 file (BrowseNexusPage.tsx - 13 strings migrated)
**Remaining:** ~1,768+ strings across 1,457 source files

### Working Examples

1. **BrowseNexusPage.tsx** (`src/extensions/browse_nexus/views/BrowseNexusPage.tsx`)
   - 13 strings migrated to proper namespaced keys
   - Uses `collection` and `common` namespaces
   - Shows proper key structure: `namespace:::section:::key`
   - Fully functional and tested

## Namespace Contents

### collection.json (13 strings)
```
browse/
  - title: "Browse Collections ({{total}})"
  - selectGame: "Please select a game to browse collections."
  - loading: "Loading collections..."
  - error: "Error loading collections:"
  - noCollections: "No collections found for this game."
  - searchPlaceholder: "Search collections..."
  - resultsCount: "{{total}} results"
  - sortBy: "Sort by"
pagination/
  - goTo: "Go to:"
  - pageNumber: "Page number"
  - go: "Go"
```

### common.json (26 lines + 1 section)
- Pluralization rules (existing)
- `actions:::search`: "Search"

## Next Steps

Future migrations should follow the pattern established in BrowseNexusPage.tsx.

### Priority Areas for Future Migration

1. **New features** (100% compliance required from day one)
2. **Collections pages** (`extensions/collections/src/views/**/*.tsx`)
   - Already has namespace defined
   - ~350+ strings to migrate
3. **Extension manager** (`src/extensions/extension_manager/**/*.tsx`)
   - Frequently used, high visibility
   - ~70+ strings
4. **Mod management core** (`src/extensions/mod_management/**/*.tsx`)
   - Critical functionality
   - ~150+ strings

### Migration Approach

- **"Fix on Touch"** - Migrate strings when working on a file
- **New Development** - All new code must use proper keys
- **No Rush** - Existing literal strings work fine, migrate incrementally
- **Follow the Example** - BrowseNexusPage.tsx shows the pattern

## Tools & Resources

- **Migration Guide:** `docs/I18N_MIGRATION_GUIDE.md`
- **Example File:** `src/extensions/browse_nexus/views/BrowseNexusPage.tsx`
- **Namespace Files:** `locales/en/*.json`
- **i18n Config:** `src/util/i18n.ts` (line 165 - namespace registration)

## Benefits of Migration

Once fully migrated, this will enable:

✅ Easy translation for external contributors (no code reading required)
✅ Professional translation services can work directly with JSON files
✅ Organized, contextual string structure
✅ Translation completeness tracking
✅ Translation memory systems
✅ Standard industry workflow

## Reference

**Russian translation example:** `C:/Users/insom/Downloads/ru/`
- 28 namespace files
- 1,159+ strings organized by feature
- Proves the namespace structure works at scale
- Shows what full migration looks like

## Configuration

### i18n.ts Namespace Registration (line 165-174)

```typescript
ns: [
  'common',
  'collection',
  'mod_management',
  'download_management',
  'profile_management',
  'nexus_integration',
  'gamemode_management',
  'extension_manager',
],
```

### Separator Configuration (line 177-178)

```typescript
nsSeparator: ':',   // namespace:section.key (standard i18next)
keySeparator: '.',  // for nested sections (standard i18next)
```

## Success Metrics

- **Foundation:** ✅ Complete (namespaces configured, example working)
- **Documentation:** ✅ Complete (guide + status docs created)
- **Proof of Concept:** ✅ Complete (BrowseNexusPage.tsx migrated)
- **Full Migration:** 🔄 In Progress (< 1% complete, incremental approach)
