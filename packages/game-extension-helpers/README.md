# @vortex/game-extension-helpers

This package provides shared helpers for modernizing legacy Vortex game
extensions. It starts with installer-path helpers today and can grow with more
shared helpers later.

## Paths

`vortex-api` callbacks sometimes hand us mixed lists of file and directory paths.
This package normalizes and separates them for Vortex extensions to use.

### The Problem

Game extensions APIs such as `registerInstaller()` with callbacks like:

```typescript
// Test if this installer can handle these files
testSupported: (files: string[], gameId: string) =>
    Promise<{
        supported: boolean;
    }>;

// Install the mod
install: (files: string[], destinationPath: string, gameId: string) =>
    Promise<{
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

### Usage

Separate mixed file and directory paths from installer callbacks:

```typescript
import { splitPathsByKind } from "@vortex/game-extension-helpers/paths";

const filesFromInstaller = [
    "Pack\\Content\\", // directory with backslashes
    "Pack\\Content\\Data.xnb", // file with backslashes
    "Pack/Mods/", // directory with forward slashes
    "/Pack/Mods/Helper/manifest.json", // file with leading slash
];

const result = splitPathsByKind(filesFromInstaller);
// result.files: ["Pack/Content/Data.xnb", "Pack/Mods/Helper/manifest.json"]
// result.directories: ["Pack/Content", "Pack/Mods"]
```

Normalize a list of file paths (not for mixed content):

```typescript
import { toRelativePaths } from "@vortex/game-extension-helpers/paths";

// ✅ CORRECT: Only pass file paths
const filePaths = toRelativePaths(result.files);
// filePaths: ["Pack/Content/Data.xnb", "Pack/Mods/Helper/manifest.json"]

// ❌ WRONG: Passing mixed content - you can't tell files from folders after normalization
const mixedPaths = toRelativePaths(["Pack/Mods/", "Pack/Mods"]);
// mixedPaths: ["Pack/Mods", "Pack/Mods"]
// Which one was the folder and which was the file? Can't tell anymore.
```

### Public API

- **`PathGroups`** - `{ files: RelativePath[], directories: RelativePath[] }`
  holds the normalized results.
- **`isDirectoryPath(path)`** - returns `true` when the path explicitly
  marks a directory (trailing `/` or `\\`).
- **`splitPathsByKind(paths)`** - separates path strings into files and
  directories based on trailing `/` or `\\` characters.
- **`toRelativePaths(files)`** - converts `string[]` to `RelativePath[]`,
  normalizing paths.

### Why directories are separate

Trailing separators indicate directories in the raw `vortex-api` input, but
`RelativePath.make()` removes them. The `directories` list keeps this
information available so extensions can check for directory markers without
modifying the shared path normalization logic.
