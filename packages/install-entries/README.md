# @vortex/install-entries

`vortex-api` callbacks sometimes hand us mixed lists of file and directory paths.
This package normalizes and separates them for Vortex extensions to use.

## The Problem

Game extensions APIs such as `registerInstaller()` with callbacks like:

```typescript
// Test if this installer can handle these files
testSupported: (files: string[], gameId: string) => Promise<{
  supported: boolean;
}>;

// Install the mod
install: (files: string[], destinationPath: string, gameId: string) => Promise<{
  instructions: IInstruction[];
}>;
```

The `files` array mixes file paths and directory paths (trailing
`/` or `\\`). There is no guarantee of the separators, or file casing
used either.

This is a legacy design we cannot change due to backwards compatibility. This
package separates files from directories and normalizes them through
`@vortex/paths`.

This pattern is common in game extensions. Rather than repeating the logic,
we've lifted it into a shared helper.

## Usage

```typescript
import { demuxInstallEntries } from "@vortex/install-entries";

const result = demuxInstallEntries([
  "Pack\\Content\\", // directory with backslashes
  "Pack\\Content\\Data.xnb", // file with backslashes
  "Pack/Mods/", // directory with forward slashes
]);

// Values shown as strings for readability; elements are RelativePath instances.
result.files;       // [RelativePath("Pack/Content/Data.xnb")]
result.directories; // [RelativePath("Pack/Content"), RelativePath("Pack/Mods")]
```

## Public API

- **`InstallEntries`** - `{ files: RelativePath[], directories: RelativePath[] }`
  holds the normalized results.
- **`isInstallDirectoryEntry(entry)`** - returns `true` when the raw installer
  entry explicitly marks a directory (trailing `/` or `\\`).
- **`demuxInstallEntries(entries)`** - takes a raw `string[]` from an installer
  callback and returns an `InstallEntries` object. Invalid path strings are
  silently skipped.

## Why directories are separate

Trailing separators indicate directories in the raw `vortex-api` input, but
`RelativePath.make()` removes them. The `directories` list keeps this
information available so extensions can check for directory markers without
modifying the shared path normalization logic.
