# Vortex Path System

A deferred-resolution path library with type-safe resolvers and cross-platform support.

## Overview

This library provides a structured approach to path handling in Vortex:

- **Deferred Resolution**: Paths stay logical until the last moment
- **Type-Safe Anchors**: Compile-time guarantees for valid anchor names
- **Cross-Platform**: Abstracts OS differences through resolvers
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
const resolver = new AppResolver(new UnixResolver());
const filePath = resolver.PathFor('userData', 'mods/skyrim');

// Path stays logical until resolved
const resolved = await filePath.resolve();
console.log(resolved); // /home/user/.local/share/app/mods/skyrim
```

### Resolvers

Resolvers map anchors to concrete OS paths. The library provides two terminal
platform resolvers and a base class for building your own:

- **UnixResolver**: Single `root` anchor → `/`
- **WindowsResolver**: 26 drive-letter anchors (`a`–`z`) → `A:\` – `Z:\`
- **MappingResolver**: Abstract base for user-defined anchor mappings

Resolvers are chainable — if a resolver doesn't handle an anchor, it delegates to its parent.

### Resolver Pipeline

After a non-terminal resolver resolves its anchor and joins the relative path,
the result flows **up** the parent chain via `toOSPath()` until a terminal
resolver (UnixResolver or WindowsResolver) finalises it:

```
Request: resolve('userData', 'mods/skyrim')
  ↓
AppResolver.resolveAnchor('userData') → '/home/user/.vortex/userData'
  ↓ joinPaths
'/home/user/.vortex/userData/mods/skyrim'
  ↓ toOSPath()  (walks up to parent)
UnixResolver.toOSPath() → returns as-is (terminal)
  ↓
ResolvedPath('/home/user/.vortex/userData/mods/skyrim')
```

Non-terminal resolvers without a parent will throw, ensuring every chain
terminates with a platform resolver.

## Quick Start

### 1. Create a Custom Resolver

```typescript
import { MappingResolver, fromRecord } from './shared/paths/resolvers/MappingResolver';
import { UnixResolver } from './shared/paths/resolvers/UnixResolver';
import { ResolvedPath } from './shared/paths/types';

class AppResolver extends MappingResolver<'userData' | 'temp'> {
  constructor(parent: IResolver) {
    super('app', parent);
  }

  protected getStrategy() {
    return fromRecord({
      userData: ResolvedPath.make('/home/user/.app/userData'),
      temp: ResolvedPath.make('/tmp/app'),
    });
  }
}

const resolver = new AppResolver(new UnixResolver());
```

### 2. Create Paths

```typescript
// Using PathFor (recommended)
const modsPath = resolver.PathFor('userData', 'mods');

// Manual construction
import { FilePath } from './shared/paths/FilePath';
import { RelativePath, Anchor } from './shared/paths/types';
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
console.log(resolved); // Platform-specific: /home/user/.app/userData/mods
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

### 5. Reverse Resolution

```typescript
// Convert OS path back to FilePath
const osPath = ResolvedPath.make('/home/user/.app/userData/mods/SkyUI');
const filePath = await resolver.tryReverse(osPath);
// → FilePath with anchor='userData', relative='mods/SkyUI'
```

## Usage Examples

### Type-Safe Anchors

```typescript
const resolver = new AppResolver(new UnixResolver());

resolver.PathFor('userData');   // ✓ Valid
resolver.PathFor('temp');       // ✓ Valid
resolver.PathFor('drive_c');    // ✗ TypeScript error!
```

### Resolver Chaining

```typescript
// Build resolver chain: app (child) → unix (parent/terminal)
const unix = new UnixResolver();
const app = new AppResolver(unix);

// app tries first, then delegates unknown anchors to unix
const path = app.PathFor('root' as any, 'etc/hosts');
const resolved = await path.resolve(); // /etc/hosts (handled by unix parent)
```

### Custom Terminal Resolvers

To create a terminal resolver (one that can produce OS paths directly),
override `toOSPath`:

```typescript
class MyTerminalResolver extends MappingResolver<'data'> {
  constructor() {
    super('terminal');
  }

  protected getStrategy() { ... }

  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    return intermediatePath; // I produce valid OS paths directly
  }
}
```

### Testing with Mock Filesystems

```typescript
import { WindowsFilesystem } from './shared/paths/filesystem/WindowsFilesystem';
import { UnixFilesystem } from './shared/paths/filesystem/UnixFilesystem';

test('Windows case insensitivity', async () => {
  const fs = new WindowsFilesystem();

  const path1 = ResolvedPath.make('C:\\Vortex\\MODS');
  const path2 = ResolvedPath.make('C:\\vortex\\mods');

  await fs.writeFile(path1, 'content', 'utf8');
  expect(await fs.exists(path2)).toBe(true); // Case insensitive!
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
AppResolver (userData, temp, home, ...)
  ↓ toOSPath() — delegates up
  ↓ (delegate if not handled)
UnixResolver / WindowsResolver (terminal — produces OS path)
  ↓
ResolvedPath
```

## API Reference

### Branded Types

#### RelativePath

```typescript
RelativePath.make(input: string): RelativePath
RelativePath.EMPTY: RelativePath
RelativePath.join(base: RelativePath, ...segments: string[]): RelativePath
RelativePath.dirname(path: RelativePath): RelativePath
RelativePath.basename(path: RelativePath, ext?: string): string
RelativePath.depth(path: RelativePath): number
RelativePath.isIn(child: RelativePath, parent: RelativePath): boolean
RelativePath.equals(a: RelativePath, b: RelativePath): boolean
RelativePath.compare(a: RelativePath, b: RelativePath): number
RelativePath.hash(path: RelativePath): number
```

#### ResolvedPath

```typescript
ResolvedPath.make(osPath: string): ResolvedPath
ResolvedPath.join(base: ResolvedPath, ...segments: string[]): ResolvedPath
ResolvedPath.dirname(path: ResolvedPath): ResolvedPath
ResolvedPath.basename(path: ResolvedPath, ext?: string): string
ResolvedPath.parse(path: ResolvedPath): ParsedPath
ResolvedPath.relative(from: ResolvedPath, to: ResolvedPath): string
```

#### Extension

```typescript
Extension.make(input: string): Extension
Extension.fromPath(filePath: string): Extension | undefined
Extension.matches(ext: Extension, filePath: string): boolean
Extension.ESP, Extension.ESM, Extension.DLL, Extension.EXE, Extension.JSON
```

#### Anchor

```typescript
Anchor.make(name: string): Anchor
Anchor.name(anchor: Anchor): string
Anchor.isAnchor(value: unknown): value is Anchor
```

### FilePath Class

```typescript
class FilePath {
  readonly relative: RelativePath;
  readonly anchor: Anchor;
  readonly resolver: IResolver;

  resolve(): Promise<ResolvedPath>;

  join(...segments: string[]): FilePath;
  withResolver(newResolver: IResolver): FilePath;
  withAnchor(newAnchor: Anchor): FilePath;
  withRelative(newRelative: RelativePath): FilePath;
  parent(): FilePath;
  basename(ext?: string): string;
  withBase(newBase: FilePath): FilePath;

  equals(other: FilePath): boolean;
  hashCode(): number;
  depth(): number;
  isIn(parent: FilePath): boolean;
  compare(other: FilePath): number;

  relativeTo(childPath: string | ResolvedPath): Promise<RelativePath | null>;
  isAncestorOf(childPath: string | ResolvedPath): Promise<boolean>;
}
```

### IResolver Interface

```typescript
interface IResolver<ValidAnchors extends string = string> {
  readonly name: string;
  readonly parent?: IResolver;

  resolve(anchor: Anchor, relative: RelativePath): Promise<ResolvedPath>;
  canResolve(anchor: Anchor): boolean;
  supportedAnchors(): Anchor[];
  PathFor<A extends ValidAnchors>(anchorName: A, relative?: string): FilePath;
  tryReverse(resolvedPath: ResolvedPath): Promise<FilePath | null>;
  getBasePaths(): Promise<Map<Anchor, ResolvedPath>>;
}
```

### IFilesystem Interface

```typescript
interface IFilesystem {
  readonly platform: 'win32' | 'linux' | 'darwin';
  readonly caseSensitive: boolean;

  readFile(path: ResolvedPath, encoding?: BufferEncoding): Promise<string | Buffer>;
  writeFile(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  appendFile(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  unlink(path: ResolvedPath): Promise<void>;

  readdir(path: ResolvedPath): Promise<FileEntry[]>;
  mkdir(path: ResolvedPath, options?: { recursive?: boolean; mode?: number }): Promise<void>;
  rmdir(path: ResolvedPath, options?: { recursive?: boolean }): Promise<void>;

  exists(path: ResolvedPath): Promise<boolean>;
  stat(path: ResolvedPath): Promise<FileEntry>;
  lstat(path: ResolvedPath): Promise<FileEntry>;

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
import { RelativePathSchema, ResolvedPathSchema } from './shared/paths/types';

RelativePathSchema.parse('mods/skyrim');  // ✓ Valid
RelativePathSchema.parse('../etc/passwd'); // ✗ Throws

ResolvedPathSchema.parse('/absolute/path'); // ✓ Valid
ResolvedPathSchema.parse('relative/path');  // ✗ Throws
```

## Performance

- **Zero-cost branded types**: No runtime overhead
- **Deferred resolution**: Paths are only resolved when needed

## Design Decisions

### Why Branded Types?

Branded types provide compile-time safety with zero runtime cost. They prevent mixing up path types (relative vs. resolved) and catch errors at build time.

### Why Deferred Resolution?

Paths can be constructed, manipulated, and serialized without filesystem access. Resolution happens only when needed, improving performance and flexibility.

### Why Resolver Chains?

Resolver chains enable modular path handling. Each resolver handles its domain (app paths, game paths) and delegates unknown anchors to the parent. Only terminal resolvers (UnixResolver, WindowsResolver) produce final OS paths.

### Why IFilesystem Abstraction?

The filesystem abstraction enables 100% cross-platform testing. Tests can simulate Windows and Unix behavior without real filesystem access.

## License

This library is part of Vortex and follows the same license.
