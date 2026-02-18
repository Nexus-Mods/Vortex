# Vortex Path System

A deferred-resolution path library with type-safe resolvers and cross-platform support.

## Overview

This library provides a structured approach to path handling in Vortex:

- **Deferred Resolution**: Paths stay logical until the last moment
- **Type-Safe Anchors**: Compile-time guarantees for valid anchor names
- **Cross-Platform**: Abstracts OS differences through resolvers
- **IPC-Ready**: Clean serialization for passing paths across processes
- **Testable**: Mock filesystem implementations for 100% cross-platform testing

## Core Concepts

### Branded Types

The library uses TypeScript branded types for compile-time safety:

- **RelativePath**: Forward-slash separated, sanitized relative paths (e.g., `"mods/skyrim/data"`)
- **ResolvedPath**: Absolute, OS-specific paths (e.g., `"C:\\Users\\...\\mods"` or `"/home/user/mods"`)
- **Extension**: File extensions with leading dot (e.g., `".esp"`, `".dll"`)
- **Anchor**: Named resolution starting points (e.g., `Symbol.for('anchor:userData')`)

### FilePath

`FilePath` combines a `RelativePath`, an `Anchor`, and an `IResolver` into a single object that defers resolution:

```typescript
import { VortexResolver } from './shared/paths';

const resolver = new VortexResolver();
const filePath = resolver.PathFor('userData', 'mods/skyrim');

// Path stays logical until resolved
const resolved = await filePath.resolve();
console.log(resolved); // C:\Users\...\AppData\Roaming\Vortex\mods\skyrim
```

### Resolvers

Resolvers map anchors to concrete OS paths:

- **VortexResolver**: App-level paths (userData, temp, documents, etc.)
- **GameResolver**: Game-specific paths (game, gameMods, gameData)
- **ProtonResolver**: Wine/Proton translation for Linux
- **CachingResolver**: TTL-based caching wrapper

Resolvers are chainable - if a resolver doesn't handle an anchor, it delegates to its parent.

## Installation

The path system is built into Vortex. Import from `shared/paths`:

```typescript
import {
  VortexResolver,
  FilePath,
  RelativePath,
  ResolverRegistry,
} from './shared/paths';
```

## Quick Start

### 1. Initialize Resolvers

```typescript
import { VortexResolver, ResolverRegistry } from './shared/paths';

// Create registry and resolver
const registry = new ResolverRegistry();
const resolver = new VortexResolver();
registry.setDefault(resolver);
```

### 2. Create Paths

```typescript
// Using PathFor (recommended)
const modsPath = resolver.PathFor('userData', 'mods');

// Manual construction
import { FilePath, RelativePath, Anchor } from './shared/paths';
const modsPath2 = new FilePath(
  RelativePath.make('mods'),
  Anchor.make('userData'),
  resolver
);
```

### 3. Resolve Paths

```typescript
// Async resolution
const resolved = await modsPath.resolve();
console.log(resolved); // Platform-specific: C:\Users\... or /home/user/...

// Sync resolution (if supported)
const resolvedSync = modsPath.resolveSync();
```

### 4. Path Operations

```typescript
// Join paths
const skyrimPath = modsPath.join('skyrim', 'data');

// Get parent
const parent = skyrimPath.parent();

// Get basename
const filename = skyrimPath.basename(); // 'data'
```

## Usage Examples

### Basic Usage

```typescript
import { VortexResolver } from './shared/paths';

const resolver = new VortexResolver();

// Create a file path
const modsPath = resolver.PathFor('userData', 'mods');

// Resolve to OS path
const resolved = await modsPath.resolve();
console.log(resolved); // Platform-specific

// Join paths
const skyrimPath = modsPath.join('skyrim', 'data');
```

### Type-Safe Anchors

```typescript
import { VortexResolver, ProtonResolver } from './shared/paths';

const vortex = new VortexResolver();

vortex.PathFor('userData');   // ✓ Valid
vortex.PathFor('temp');       // ✓ Valid
vortex.PathFor('drive_c');    // ✗ TypeScript error!

const proton = new ProtonResolver('/steam', '12345');

proton.PathFor('drive_c');    // ✓ Valid (Proton-specific)
proton.PathFor('userData');   // ✗ TypeScript error!
```

### Resolver Chaining

```typescript
import { VortexResolver, GameResolver, ProtonResolver } from './shared/paths';

// Build resolver chain
const vortex = new VortexResolver();
const game = new GameResolver(getState, vortex);
const proton = new ProtonResolver('/steam', '12345', game);

// ProtonResolver tries first, then GameResolver, then VortexResolver
const path = proton.PathFor('documents');
const resolved = await path.resolve();
```

### IPC Serialization

```typescript
import { FilePathIPC, ResolverRegistry } from './shared/paths';

// Main process - serialize for IPC
const filePath = resolver.PathFor('userData', 'mods');
const serialized = FilePathIPC.serialize(filePath);

// Send across process boundary
ipcMain.send('path-data', serialized);

// Renderer process - deserialize
// (Assuming you've set up a registry in the renderer process)
ipcRenderer.on('path-data', (event, serialized) => {
  const filePath = FilePathIPC.deserialize(
    serialized,
    rendererRegistry  // Use your renderer-side registry
  );
  const resolved = await filePath.resolve();
});
```

### Alternative: Pre-Resolved Paths

When the receiving side doesn't need anchor context:

```typescript
// Resolve before sending
const resolvedPath = await FilePathIPC.serializeResolved(filePath);
ipcMain.send('resolved-path', resolvedPath);

// Receiver gets the string
ipcRenderer.on('resolved-path', (event, path: string) => {
  const resolved = ResolvedPath.make(path);
  // Use directly with filesystem
});
```

### Testing with Mock Filesystems

```typescript
import { WindowsFilesystem, UnixFilesystem } from './shared/paths';

test('Windows case insensitivity', async () => {
  const fs = new WindowsFilesystem();

  const path1 = ResolvedPath.make('C:\\Vortex\\MODS');
  const path2 = ResolvedPath.make('C:\\vortex\\mods');

  await fs.writeFile(path1, 'content', 'utf8');
  expect(await fs.exists(path2)).toBe(true); // Case insensitive!
});

test('Unix case sensitivity', async () => {
  const fs = new UnixFilesystem();

  const path1 = ResolvedPath.make('/vortex/MODS');
  const path2 = ResolvedPath.make('/vortex/mods');

  await fs.writeFile(path1, 'content1', 'utf8');
  await fs.writeFile(path2, 'content2', 'utf8');

  // Two separate files
  expect(await fs.readFile(path1, 'utf8')).toBe('content1');
  expect(await fs.readFile(path2, 'utf8')).toBe('content2');
});
```

## Architecture

### Type Flow

```
string → RelativePath → FilePath → resolve() → ResolvedPath → IFilesystem
         (sanitized)   (+ Anchor              (OS-specific)  (operations)
                       + Resolver)
```

### Resolver Chain

```
Request
  ↓
ProtonResolver (Linux-specific anchors: drive_c, programFiles, ...)
  ↓ (delegate if not handled)
GameResolver (game, gameMods, gameData, gameSaves)
  ↓ (delegate if not handled)
VortexResolver (userData, temp, documents, ...)
  ↓ (delegate if not handled)
Error: No resolver can handle this anchor
```

## Resolver Reference

### VortexResolver

Maps Vortex application paths:

- `userData` - User data directory
- `temp` - Temporary directory
- `documents` - User documents
- `appData` - Application data
- `localAppData` - Local application data
- `home` - User home directory
- `desktop` - Desktop directory
- `base` - Application base path
- `assets` - Assets directory
- `modules` - Node modules
- `bundledPlugins` - Bundled plugins
- `locales` - Locale files
- `package` - Package directory
- `application` - Application directory
- `exe` - Executable path

### GameResolver

Maps game-specific paths (requires Redux state):

- `game` - Game installation directory
- `gameMods` - Game mods directory
- `gameData` - Game data directory
- `gameSaves` - Game saves directory

### ProtonResolver

Maps Proton/Wine paths (Linux only):

- `drive_c` - C:\ root in Wine prefix
- `documents` - My Documents
- `appData` - Application Data
- `localAppData` - Local Settings/Application Data
- `home` - User profile directory
- `programFiles` - Program Files
- `programFilesX86` - Program Files (x86)

## API Reference

### Branded Types

#### RelativePath

```typescript
// Constructor
RelativePath.make(input: string): RelativePath

// Empty path
RelativePath.EMPTY: RelativePath

// Operations
RelativePath.join(base: RelativePath, ...segments: string[]): RelativePath
RelativePath.dirname(path: RelativePath): RelativePath
RelativePath.basename(path: RelativePath, ext?: string): string
```

#### ResolvedPath

```typescript
// Constructor
ResolvedPath.make(osPath: string): ResolvedPath

// Operations
ResolvedPath.join(base: ResolvedPath, ...segments: string[]): ResolvedPath
ResolvedPath.dirname(path: ResolvedPath): ResolvedPath
ResolvedPath.basename(path: ResolvedPath, ext?: string): string
ResolvedPath.parse(path: ResolvedPath): ParsedPath
ResolvedPath.relative(from: ResolvedPath, to: ResolvedPath): RelativePath
```

#### Extension

```typescript
// Constructor
Extension.make(input: string): Extension

// Extract from path
Extension.fromPath(filePath: string): Extension | undefined

// Check match
Extension.matches(ext: Extension, filePath: string): boolean

// Common extensions
Extension.ESP, Extension.ESM, Extension.DLL, Extension.EXE, Extension.JSON
```

#### Anchor

```typescript
// Constructor
Anchor.make(name: string): Anchor

// Get name
Anchor.name(anchor: Anchor): string

// Validation
Anchor.isAnchor(value: unknown): value is Anchor
```

### FilePath Class

```typescript
class FilePath {
  // Properties
  readonly relative: RelativePath;
  readonly anchor: Anchor;
  readonly resolver: IResolver;

  // Resolution
  resolve(): Promise<ResolvedPath>;
  resolveSync(): ResolvedPath;

  // Builder methods (return new FilePath)
  join(...segments: string[]): FilePath;
  withResolver(newResolver: IResolver): FilePath;
  withAnchor(newAnchor: Anchor): FilePath;
  withRelative(newRelative: RelativePath): FilePath;
  parent(): FilePath;
  basename(ext?: string): string;

  // Serialization
  toJSON(): SerializedFilePath;
  static fromJSON(json: SerializedFilePath, registry: IResolverRegistry): FilePath;

  // Equality
  equals(other: FilePath): boolean;
  hashCode(): string;
}
```

### IResolver Interface

```typescript
interface IResolver<ValidAnchors extends string = string> {
  readonly name: string;
  readonly parent?: IResolver;

  resolve(anchor: Anchor, relative: RelativePath): Promise<ResolvedPath>;
  resolveSync?(anchor: Anchor, relative: RelativePath): ResolvedPath;

  canResolve(anchor: Anchor): boolean;
  supportedAnchors(): Anchor[];

  PathFor<A extends ValidAnchors>(anchorName: A, relative?: string): FilePath;
}
```

### IFilesystem Interface

```typescript
interface IFilesystem {
  readonly platform: 'win32' | 'linux' | 'darwin';
  readonly caseSensitive: boolean;

  // Read operations
  readFile(path: ResolvedPath, encoding?: BufferEncoding): Promise<string | Buffer>;
  readFileSync(path: ResolvedPath, encoding?: BufferEncoding): string | Buffer;

  // Write operations
  writeFile(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  writeFileSync(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): void;
  appendFile(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  unlink(path: ResolvedPath): Promise<void>;

  // Directory operations
  readdir(path: ResolvedPath, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]>;
  mkdir(path: ResolvedPath, options?: { recursive?: boolean; mode?: number }): Promise<void>;
  rmdir(path: ResolvedPath, options?: { recursive?: boolean }): Promise<void>;

  // Metadata operations
  exists(path: ResolvedPath): Promise<boolean>;
  stat(path: ResolvedPath): Promise<Stats>;

  // Copy/move operations
  copy(src: ResolvedPath, dest: ResolvedPath, options?: CopyOptions): Promise<void>;
  rename(src: ResolvedPath, dest: ResolvedPath): Promise<void>;
}
```

## Testing

Run tests:

```bash
yarn test src/shared/paths/__tests__
```

Tests use mock filesystems for 100% cross-platform coverage.

## Validation

All path types use Zod schemas for runtime validation:

```typescript
import { RelativePathSchema, ResolvedPathSchema } from './shared/paths';

RelativePathSchema.parse('mods/skyrim');  // ✓ Valid
RelativePathSchema.parse('../etc/passwd'); // ✗ Throws

ResolvedPathSchema.parse('/absolute/path'); // ✓ Valid
ResolvedPathSchema.parse('relative/path');  // ✗ Throws
```

## Performance

- **Zero-cost branded types**: No runtime overhead
- **Deferred resolution**: Paths are only resolved when needed
- **Optional caching**: Use `CachingResolver` wrapper for repeated resolutions
- **Sync when possible**: Most resolvers support `resolveSync()` for zero async overhead

## Migration Guide

This library is **not integrated** with existing Vortex code yet. It's designed as an addon for future use. Integration will happen in a separate phase.

To start using the path system:

1. Import the library
2. Initialize resolvers
3. Use `FilePath` for new code
4. Gradually migrate existing path handling

## Design Decisions

### Why Branded Types?

Branded types provide compile-time safety with zero runtime cost. They prevent mixing up path types (relative vs. resolved) and catch errors at build time.

### Why Deferred Resolution?

Paths can be constructed, manipulated, and serialized without filesystem access. Resolution happens only when needed, improving performance and flexibility.

### Why Resolver Chains?

Resolver chains enable modular path handling. Each resolver handles its domain (app paths, game paths, Proton paths) and delegates unknown anchors to the parent.

### Why IFilesystem Abstraction?

The filesystem abstraction enables 100% cross-platform testing. Tests can simulate Windows and Unix behavior without real filesystem access.

## Future Work

- Integration with existing Vortex path handling
- Migration tooling for converting old APIs
- Additional resolvers (archives, network paths)
- Performance benchmarks
- Developer migration guide

## License

This library is part of Vortex and follows the same license.
