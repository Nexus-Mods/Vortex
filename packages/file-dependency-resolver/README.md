# @nexusmods/file-dependency-resolver

Stub package for the file-to-file dependency resolver. See **[LAZ-552](https://linear.app/nexus-mods/issue/LAZ-552)** (design) and **[LAZ-473](https://linear.app/nexus-mods/issue/LAZ-473)** (API definition).

## Purpose

A pure, **platform-agnostic** resolver loop and `resolve()` function that powers the file
dependency health-check page. The same module is intended to run on the client
(Vortex) now, with a path to move more of it server-side later, so it must stay
free of any platform-specific dependencies.

## Boundaries

- **No** imports from Vortex, electron, nexus-api, redux, fs, etc.
- Inputs and outputs are plain serialisable data.
- This module **computes only**: the caller fetches data and performs the
  resulting actions (downloads/installs).

## Shape (to be designed)

- `resolve(request)` - one deterministic resolution pass: input state -> result.
- `runResolverLoop(request)` - drives `resolve()` until it settles, folding user
  decisions (clash / choice resolutions) back into each pass.
- `ResolveRequest` / `ResolveResult` in [`src/types.ts`](src/types.ts) - schema TBD.

## Using it from Vortex

This is a pnpm workspace package, so it is consumed by name with a `workspace:*`
range - never imported by relative path.

It is **already wired into the renderer**: `@nexusmods/file-dependency-resolver`
is in `src/renderer/package.json`, which is where the health-check extension
lives (`src/renderer/src/extensions/health_check/` is bundled into the renderer
and has no `package.json` of its own). So just run `pnpm install` from the repo
root, then import by package name:

```ts
import { runResolverLoop, resolve } from "@nexusmods/file-dependency-resolver";
import type { ResolveRequest } from "@nexusmods/file-dependency-resolver";

// e.g. inside the mod requirements health check
// (src/renderer/src/extensions/health_check/checks/modRequirementsCheck.ts)
const request: ResolveRequest = {
    // TODO: build from Vortex state + the batch dependency API response
    //  - installed files (fileUid / modId / fileId / version from mod.attributes)
    //  - declared requirements returned by the backend
    //  - any decisions the user already made this session
};

const result = await runResolverLoop(request);
// map result -> IModMissingRequirements / health-check page rows,
// and turn planned download actions into nxm:// downloads via onDownloadRequirement.
```

Keep Vortex-specific glue (state selectors, nxm download dispatch, UI mapping)
**in the extension**, not in this package - the package must stay portable so it
can move server-side later.

## Status

Stub only. Schema and implementation are intentionally left open for the
assignee. Function bodies throw `not implemented`.

## Scripts

```
pnpm build      # tsdown -> dist/
pnpm typecheck  # tsc -p ./tsconfig.json
pnpm test       # vitest run
```
