# @nexusmods/mod-pipeline

The mod pipeline's lockfile contract, the resolver that produces it and the planner
that consumes it. `resolve(input)` turns the mods that deploy to a game into a
`Lockfile`: every file Vortex would deploy, where it comes from, and the absolute
path it deploys to. `plan(current, previous, disk)` turns two lockfiles and a disk
scan into the operations that bring the disk to the current lockfile.

## Portability is the point

The package has to run in Vortex's renderer, in a utility process, and later on the
backend. Two rules keep it that way:

- **Nothing from Vortex.** No `@vortex/*`, Electron, Redux, `fs` or HTTP.
- **The caller hands in explicit data.** `ResolverInput` holds the mods that
  deploy, in order, each with its origin, staged files and overridden paths.
  Anything that needs Vortex or the disk is the caller's job.

Paths are absolute and use `/` separators.

zod is imported only through `src/zodJitless.ts`. zod 4 compiles parsers with
`new Function`, which the renderer's CSP forbids, and it decides per schema when
the schema is built. The wrapper sets `jitless` before any schema here exists, so
the package does not depend on its host's load order.

## Schemas and types

Each contract is a hand-written type plus a zod schema annotated with that type.
`isolatedDeclarations` rules out inferring exported types from schemas, so every
schema module also asserts at compile time that the schema's inferred type and the
hand-written type are mutually assignable (`src/typeChecks.ts`). A field added to
one and not the other fails typecheck.

## Planner

`plan` is a three way merge per destination of the current lockfile, the previous
lockfile (absent on a first run) and a `DiskScan` the caller takes beforehand; it
never touches the disk. `ACTIONS` in `src/plan.ts` is the decision table and
documents each state. LINK and UNLINK name no method: Apply deploys with the
game's deployment method (hardlink, symlink or move).

The rules the table encodes:

- What the previous lockfile deployed is ours: it is unlinked, never backed up.
  Anything else in the way is backed up first, even when it has the current
  content, so a game file we take over is never lost when the mod goes.
- A file is the same only when both its content and its origin are, so the same
  bytes from another mod relink and a symlink never points into a removed mod.
- An entry the scan did not hash (`?`) counts as what the previous lockfile
  deployed there. The v1 scan hashes nothing, so in v1 an edit made outside
  Vortex is overwritten; the rows that compare disk content need a scan that
  hashes, and the fixtures cover them.
- BACKUP and UNLINK run before every LINK, so each LINK lands on an empty path
  and a file and a folder of ours can swap places.
- Files on disk that neither lockfile lists are left alone.

Backups are taken, never restored.

## Fixtures

`fixtures/resolver/*.json` each hold `{ name, input, expected }`.
`src/resolve.fixtures.test.ts` parses every fixture, resolves it twice, and expects
both results to be identical and equal to `expected`. The test name is the
fixture's `name`.

`fixtures/planner/*.json` each hold `{ name, current, previous?, disk, expected }`,
one per row of the decision table plus links, files only on disk and a combined
plan. `src/plan.fixtures.test.ts` plans each twice the same way.

Absolute paths live under `/fixture-root`, one folder per location, so fixtures
carry no machine's paths or user names:

| Location              | Fixture path                 |
| --------------------- | ---------------------------- |
| Game install          | `/fixture-root/game`         |
| Local app data        | `/fixture-root/localAppData` |
| Documents (game INIs) | `/fixture-root/documents`    |
| Staging folder        | `/fixture-root/staging`      |

## Key Files

- `src/lockfile.ts` - `Lockfile`, `FileSource` and `FileOrigin`, the shape the Lockfile ADR defines
- `src/resolverInput.ts` - `ResolverInput`, the mods the resolver reads
- `src/resolve.ts` - the resolver
- `src/diskScan.ts` - `DiskScan`, the files under the deployment targets
- `src/plan.ts` - the planner, its `Operation` contract and decision table
- `src/resolverFixture.ts`, `src/plannerFixture.ts`, `src/loadFixtures.ts` - the fixture contracts and their loader

## Scripts

```
pnpm build      # tsdown -> dist/
pnpm typecheck  # tsc -p ./tsconfig.json
pnpm test       # vitest run
pnpm lint       # oxlint
```
