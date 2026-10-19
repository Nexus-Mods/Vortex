# @nexusmods/mod-pipeline

The mod pipeline's lockfile contract and the resolver that produces it.
`resolve(state, gameFacts)` turns a game's enabled mods into a `Lockfile`: every
file Vortex would deploy, where it comes from, and the absolute path it deploys to.

## Portability is the point

The package has to run in Vortex's renderer, in a utility process, and later on the
backend. Two rules keep it that way:

- **Nothing from Vortex.** No `@vortex/*`, Electron, Redux, `fs` or HTTP. The
  caller hands in plain data.
- **The caller works out what needs Vortex.** `IState` is the subset of Vortex
  state the resolver reads, at the same paths and with the same names, so the
  renderer can pass its state as is. Everything that needs Vortex code or the disk
  comes in as `GameFacts`: the deployment order (`doSortMods`), and each staged
  file's absolute destination (`getModPaths` plus the staging folder) and MD5.

Paths use `/` separators. The resolver turns any `\` it receives into `/`, since
`IMod.fileOverrides` in Vortex state holds native paths.

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

## Fixtures

`fixtures/resolver/*.json` each hold `{ name, state, gameFacts, expected }`.
`src/resolve.fixtures.test.ts` parses every fixture, resolves it twice, and expects
both results to be identical and equal to `expected`. The test name is the
fixture's `name`.

Absolute paths live under `/fixture-root`, one folder per location, so fixtures
carry no machine's paths or user names:

| Location              | Fixture path                 |
| --------------------- | ---------------------------- |
| Game install          | `/fixture-root/game`         |
| Local app data        | `/fixture-root/localAppData` |
| Documents (game INIs) | `/fixture-root/documents`    |

## Key Files

- `src/lockfile.ts` - `Lockfile` and `FileSource`, the shape the Lockfile ADR defines
- `src/state.ts` - the `IState` subset the resolver reads
- `src/gameFacts.ts` - `GameFacts`, what Vortex works out outside its state
- `src/resolve.ts` - the resolver
- `src/resolverFixture.ts`, `src/loadFixtures.ts` - the fixture contract and its loader

## Scripts

```
pnpm build      # tsdown -> dist/
pnpm typecheck  # tsc -p ./tsconfig.json
pnpm test       # vitest run
pnpm lint       # oxlint
```
