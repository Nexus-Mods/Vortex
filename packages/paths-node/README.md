# @vortex/paths-node

Node.js filesystem implementation for the @vortex/paths library.

## What this does

This package provides the Node.js bridge for `@vortex/paths`. While the core
library handles path abstractions, this package connects them to your actual
filesystem using Node.js's `fs` module.

## Installation

```bash
npm install @vortex/paths-node
```

## Quick start

```typescript
import { NodeFilesystem, UnixResolver } from '@vortex/paths-node';

// Create the Node.js filesystem
const fs = new NodeFilesystem();

// Create a resolver (passes the filesystem for case-sensitivity checks)
const resolver = new UnixResolver(undefined /* parent */, fs /* filesystem */);

// Create a FilePath using the resolver's PathFor helper
const configPath = resolver.PathFor('root', 'home/user/config.json');

// Resolve to an actual OS path (returns a Promise<ResolvedPath>)
const realPath = await configPath.resolve();
// -> '/home/user/config.json'

// Read the file using the filesystem
const content = await fs.readFile(realPath, 'utf-8');
console.log(content);
```

## What's included

This package exports:

1. **`NodeFilesystem`** - The Node.js filesystem implementation
2. **Everything from @vortex/paths** - All path types and utilities

So you can import everything from one place:

```typescript
import {
  NodeFilesystem,
  FilePath,
  RelativePath,
  ResolvedPath,
  Anchor,
  Extension,
  UnixResolver,
  WindowsResolver,
  BaseResolver,
  MappingResolver,
  IFilesystem,
  IResolverBase,
  // ... everything else
} from '@vortex/paths-node';
```

## NodeFilesystem

The bridge to Node.js's filesystem:

```typescript
const fs = new NodeFilesystem();

// Platform info
console.log(fs.platform);       // 'windows' or 'unix'
console.log(fs.caseSensitive);  // false on Windows, true elsewhere
console.log(fs.sep);            // '\\' on Windows, '/' on Unix

// Read operations
const content = await fs.readFile(path, 'utf-8');
const entries = await fs.readdir(path);
const stats = await fs.stat(path);

// Write operations
await fs.writeFile(path, 'content', 'utf-8');
await fs.mkdir(path, { recursive: true });

// Copy and move (overwrite is true by default!)
await fs.copy(src, dest);                    // Will overwrite if exists
await fs.copy(src, dest, { overwrite: false }); // Skip if exists
await fs.rename(src, dest);

// Other operations
await fs.exists(path);
await fs.unlink(path);
await fs.rmdir(path, { recursive: true });
```

## Complete documentation

This package re-exports everything from `@vortex/paths`. See the
`@vortex/paths` package for full documentation on:

- `FilePath`, `RelativePath`, `ResolvedPath` - Path types and manipulation
- Anchors and Extensions - Path components  
- Creating custom resolvers - Build your own resolvers
- Platform resolvers - Unix and Windows resolvers
- Reverse resolution - Convert OS paths back to FilePaths

(When viewing in the monorepo: see the `packages/paths/` directory)

## Why two packages?

- **@vortex/paths** - Core path logic, works anywhere (Node.js, browser,
  custom runtimes)
- **@vortex/paths-node** - Just the Node.js filesystem bridge

This split lets you use the path system in browsers or other environments by
providing your own `IFilesystem` implementation.

## See also

- `@vortex/paths` - Complete API documentation and examples
