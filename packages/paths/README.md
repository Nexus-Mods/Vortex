# @vortex/paths

A path abstraction library that makes working with files and folders easier,
especially when dealing with different platforms or complex setups like
Wine/Proton.

## What this does

When you're building an app that works with files, you often run into situations
like:
- Your code needs to work on both Windows and Linux
- You're running Windows games on Linux through Proton
- You want to say "the user's Documents folder" without hardcoding paths
- Case sensitivity matters (Windows doesn't care about uppercase/lowercase,
  Linux does)

This library solves those problems by letting you work with **logical paths** that
get converted to actual filesystem paths only when needed.

## Core concepts

### FilePath

The main thing you'll use. A `FilePath` represents a file or folder location
without being tied to a specific OS path yet.

```typescript
import { FilePath, Anchor, RelativePath, BaseResolver } from '@vortex/paths';

// Create a path to the user's mods folder
const modsPath = new FilePath(
  RelativePath.make('mods/skyrim'),  // relative part
  Anchor.make('userData'),            // anchor point
  resolver                            // knows how to resolve the anchor
);

// Later, when you need the actual path:
const realPath = await modsPath.resolve();
// -> '/home/user/.vortex/mods/skyrim' on Linux
// -> 'C:\Users\user\AppData\Roaming\Vortex\mods\skyrim' on Windows
```

### Anchors

Anchors are named starting points for paths. Instead of hardcoding
`/home/user/Documents`, you use an anchor like `documents`.

```typescript
import { Anchor } from '@vortex/paths';

const docs = Anchor.make('documents');
const temp = Anchor.make('temp');
const game = Anchor.make('game');
```

### RelativePath

Normalizes path-like input into a safe relative path: backslashes become forward
slashes, leading/trailing slashes are stripped, and `..` segments are rejected.

```typescript
import { RelativePath } from '@vortex/paths';

const path = RelativePath.make('mods/skyrim/data');
// ✓ Valid: 'mods/skyrim/data'
// ✓ Normalized: '/mods/skyrim' -> 'mods/skyrim'
// ✓ Normalized: 'mods\\skyrim' -> 'mods/skyrim'
// ✗ Invalid: 'mods/../../etc' (tries to escape)
```

### ResolvedPath

An absolute OS path with platform-specific separators. This is what you get after
calling `resolve()` on a FilePath.

```typescript
import { ResolvedPath } from '@vortex/paths';

const path = ResolvedPath.make('/home/user/mods');
// On Linux: '/home/user/mods'
// On Windows: 'C:\Users\user\mods' (when resolved from a Windows resolver)
```

### Resolvers

Resolvers know how to turn an anchor + relative path into an actual OS path. You
can chain them together.

```typescript
import { UnixResolver, BaseResolver, IFilesystem } from '@vortex/paths';

// You need a filesystem implementation (provided by @vortex/paths-node in Node.js)
// const fs: IFilesystem = new NodeFilesystem(); // from @vortex/paths-node

// Terminal resolver - knows how to resolve to actual filesystem
const unix = new UnixResolver(undefined /* parent */, fs /* filesystem */);

// Custom resolver that adds your app's anchors
class AppResolver extends BaseResolver<'userData' | 'temp'> {
  async resolveAnchor(anchor) {
    if (anchor === Anchor.make('userData')) {
      return ResolvedPath.make('/home/user/.vortex');
    }
    // ... etc
  }
}

const app = new AppResolver('app' /* name */, unix /* parent */, fs /* filesystem */);
```

## Building paths

```typescript
import { RelativePath } from '@vortex/paths';

// Join paths together
const path1 = RelativePath.join('mods', 'skyrim');
// -> 'mods/skyrim'

const path2 = RelativePath.join(path1, 'data', 'plugin.esp');
// -> 'mods/skyrim/data/plugin.esp'

// Get directory or filename
const dir = RelativePath.dirname('mods/skyrim/data.esp');
// -> 'mods/skyrim'

const file = RelativePath.basename('mods/skyrim/data.esp');
// -> 'data.esp'

// Other useful methods
const depth = RelativePath.depth('mods/skyrim/data');  // -> 3
const isIn = RelativePath.isIn(
  RelativePath.make('mods/skyrim/data'),
  RelativePath.make('mods')
);  // -> true
const hash = RelativePath.hash('mods/skyrim');  // FNV-1a hash
```

## Extensions

```typescript
import { Extension } from '@vortex/paths';

const ext = Extension.make('.esp');
// Always lowercase, always starts with a dot

// Extract extension from a path
const fromPath = Extension.fromPath('plugin.ESP');  // -> '.esp'

// Check if a path has an extension
if (Extension.matches(Extension.ESP, 'plugin.ESP')) {
  // matches regardless of case
}

// Built-in constants
Extension.ESP       // '.esp'
Extension.ESM       // '.esm'
Extension.DLL       // '.dll'
Extension.EXE       // '.exe'
Extension.JSON      // '.json'
Extension.ZIP       // '.zip'
Extension.RAR       // '.rar'
Extension.SEVENZIP  // '.7z'
```

## FilePath operations

`FilePath` has many methods for manipulating paths:

```typescript
// Navigate the path
const parent = myPath.parent();           // Get parent directory
const name = myPath.basename();           // Get filename
const nameNoExt = myPath.basename('.esp'); // Get filename without extension

// Transform the path (returns new FilePath)
const withFile = myPath.join('plugin.esp');
const withAnchor = myPath.withAnchor(Anchor.make('game'));
const withRel = myPath.withRelative(RelativePath.make('new/path'));

// Compare paths
const isEqual = myPath.equals(otherPath);
const isAncestor = await myPath.isAncestorOf('/home/user/mods/skyrim');
const depth = myPath.depth();

// Reverse resolution - get relative path to a base
const rel = await myPath.relativeTo('/home/user');
// -> RelativePath for the portion after the base
```

## Filesystem abstraction

The `IFilesystem` interface lets you interact with files without knowing if it's
a real filesystem, an archive, or a mock for testing.

```typescript
import { IFilesystem, FileType } from '@vortex/paths';

async function listMods(fs: IFilesystem, path: FilePath) {
  const resolved = await path.resolve();
  const entries = await fs.readdir(resolved);

  for (const entry of entries) {
    if (entry.type === FileType.Directory) {
      console.log(`Directory: ${entry.name}`);
    } else {
      console.log(`File: ${entry.name} (${entry.size} bytes)`);
    }
  }
}
```

## Platform resolvers

We include resolvers for common platforms:

### UnixResolver

Resolves the `root` anchor to `/`.

```typescript
import { UnixResolver } from '@vortex/paths';

const resolver = new UnixResolver(undefined, filesystem);
const path = resolver.PathFor('root', 'home/user/documents');
const resolved = await path.resolve();  // -> '/home/user/documents'
```

### WindowsResolver

Resolves drive letter anchors (`a` through `z`) to Windows drives.

```typescript
import { WindowsResolver } from '@vortex/paths';

const resolver = new WindowsResolver(undefined, filesystem);
const path = resolver.PathFor('c', 'Users/user/Documents');
const resolved = await path.resolve();  // -> 'C:\Users\user\Documents'
```

### MappingResolver

An easier way to create custom resolvers using a mapping function:

```typescript
import { MappingResolver, fromRecord, ResolvedPath } from '@vortex/paths';

class AppResolver extends MappingResolver<'data' | 'config'> {
  protected getStrategy() {
    return fromRecord({
      data: '/app/data',      // strings work fine here
      config: '/app/config',
    });
  }
}

const base = new UnixResolver(undefined, fs);
const app = new AppResolver('app', base, fs);
const dataPath = app.PathFor('data', 'mods/skyrim');
const resolved = await dataPath.resolve();  // -> '/app/data/mods/skyrim'
```

## Reverse resolution

Convert an OS path back to a `FilePath`:

```typescript
// Convert an absolute path back to a FilePath
const filePath = await resolver.tryReverse(
  ResolvedPath.make('/home/user/.vortex/mods/skyrim')
);
// -> FilePath with anchor 'userData' and relative 'mods/skyrim'

// Or get all base paths
const bases = await resolver.getBasePaths();
// Map of anchor -> `ResolvedPath` for all supported anchors
```

## Why branded types?

We use TypeScript "branded types" to catch mistakes at compile time:

```typescript
function doSomething(path: RelativePath) { ... }

// This is a string, not a RelativePath
const str = 'mods/skyrim';
doSomething(str);  // TypeScript error!

// This is a RelativePath
const rel = RelativePath.make('mods/skyrim');
doSomething(rel);  // OK
```

The runtime validation ensures paths are always in a consistent format (forward
slashes, no trailing slashes, etc.).

## Advanced usage

### Resolver introspection

Resolvers have methods for checking capabilities:

```typescript
// Check if resolver supports an anchor
const canResolve = resolver.canResolve(Anchor.make('userData'));  // -> boolean

// Get all supported anchors
const anchors = resolver.supportedAnchors();  // -> Anchor[]

// Get the filesystem
const fs = resolver.getFilesystem();  // -> IFilesystem
```

### ResolvedPath manipulation

**Note:** You normally shouldn't manipulate ResolvedPath directly. Work with
`FilePath` and `RelativePath` instead, then call `.resolve()` when you need the
actual OS path. These methods are only for edge cases.

```typescript
import { ResolvedPath } from '@vortex/paths';

// Parse into components (useful for extracting filename/extension)
const parsed = ResolvedPath.parse('/home/user/mods/skyrim.esp');
// -> { root: '/', dir: '/home/user/mods', base: 'skyrim.esp',
//      ext: '.esp', name: 'skyrim' }

// Get relative path between two OS paths
const rel = ResolvedPath.relative(
  ResolvedPath.make('/home/user'),
  ResolvedPath.make('/home/user/mods/skyrim')
);
// -> 'mods/skyrim'
```

### Low-level path utilities

For rare cases where you need raw path manipulation:

```typescript
import { posix, win32, forPlatform } from '@vortex/paths';

// Platform-specific path operations
posix.join('mods', 'skyrim');   // -> 'mods/skyrim'
win32.join('mods', 'skyrim');   // -> 'mods\\skyrim'
```

## Case-insensitive comparison

Case-insensitive path and filename helpers use `toLowerCase()`.

Known limitations:

- **German sharp-s (ß)**: "naß.esp" does not match "nass.esp" or "naSS.esp"

`toLowerCase()` is the current tradeoff because it is fast.
German filenames with ß are rare in file names, especially in game modding.

### Benchmarks

**Equals comparison:**

| Approach        | Trimmed Mean  | German `ß` | Turkish `i`/`ı` |
| --------------- | ------------- | ---------- | --------------- |
| `toLowerCase()` | 55.37 M ops/s | Fails      | Correct         |
| `toUpperCase()` | 39.22 M ops/s | Correct    | Fails           |
| `foldcase`      | 1.16 M ops/s  | Correct    | Correct         |

**Hash operations:**

| Approach        | Trimmed Mean  | German `ß` | Turkish `i`/`ı` |
| --------------- | ------------- | ---------- | --------------- |
| `toLowerCase()` | 35.95 M ops/s | Fails      | Correct         |
| `toUpperCase()` | 30.34 M ops/s | Correct    | Fails           |
| `foldcase`      | 2.16 M ops/s  | Correct    | Correct         |

**Segments and split:**

| Approach        | Trimmed Mean  | German `ß` | Turkish `i`/`ı` |
| --------------- | ------------- | ---------- | --------------- |
| `toLowerCase()` | 13.04 M ops/s | Fails      | Correct         |
| `toUpperCase()` | 12.21 M ops/s | Correct    | Fails           |

`foldcase` (from `@ar-nelson/foldcase`) is included for reference as an
implementation that handles both German `ß` and Turkish `i`/`ı` correctly, but
is ~30x slower than native methods.
