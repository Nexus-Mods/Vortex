# @nexusmods/file-dependency-resolver

The file-to-file dependency resolver behind Vortex's file-level requirements
health check. Given the user's installed files plus a set of injected data-fetch
ports, `checkFileLevelRequirements(context)` reports which file dependencies are
satisfied, missing, or the wrong version.

## Portability is the point

This package must stay platform-agnostic — no Vortex, electron, redux, fs, or
HTTP/auth coupling — so the same logic can be reused/moved elsewhere. Two rules keep
it that way:

- **Data comes through injected `ResolverPorts`** (`fetchCandidates`,
  `fetchFileVersionDetails`, `fetchModDetails`). The package never makes HTTP
  calls or knows about Nexus auth; the caller supplies the ports.
- **The caller owns the actions.** The resolver only _reports_ what's needed;
  downloads, installs, state reads, and UI mapping live in the consumer.

The entry point and the data contract are in
[`src/checkFileLevelRequirements.ts`](src/checkFileLevelRequirements.ts) and
[`src/types.ts`](src/types.ts).

## Consuming it

A pnpm workspace package — imported by name (`@nexusmods/file-dependency-resolver`),
never by relative path. It's depended on by `src/renderer`, where the health-check
extension lives (`src/renderer/src/extensions/health_check/`). All Vortex-specific
glue — ports backed by the Nexus v3/v2 APIs, gathering installed files, mapping the
report to UI, nxm downloads — stays in that extension, not here.

## Scripts

```
pnpm build      # tsdown -> dist/
pnpm typecheck  # tsc -p ./tsconfig.json
pnpm test       # vitest run
pnpm lint       # oxlint
```
