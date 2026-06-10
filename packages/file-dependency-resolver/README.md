# @nexusmods/file-dependency-resolver

Stub package for the file-to-file dependency resolver. See **[LAZ-552](https://linear.app/nexus-mods/issue/LAZ-552)** (design) and **[LAZ-473](https://linear.app/nexus-mods/issue/LAZ-473)** (API definition).

## Purpose

A **portable** `checkFileLevelRequirements()` function that powers the file
dependency health-check page. The same module is intended to run on the client
(Vortex) now, with a path to move more of it server-side later, so it must stay
free of platform-specific dependencies.

The entry point itself is **not pure** - it may make API requests to fetch the
dependency data it needs. The matching/decision logic that runs over the fetched
data is factored into a pure helper, but that is an internal implementation
detail, not part of the public surface.

## Boundaries

- **Portable**: no coupling to Vortex, electron, redux, fs, etc., so the module
  can move server-side later.
- The entry point **may fetch** the dependency data it needs (it is not a no-I/O
  pure function).
- The caller still owns the resulting **actions** (downloads / installs); the
  module only reports what is needed.

## Shape (to be designed)

- `checkFileLevelRequirements(context)` - the single entry point. May fetch
  dependency data, then computes (via a pure internal helper) the report needed
  to build the health check. Async; no user interaction; no loop.
- The module never asks the user for anything. When the install set changes (e.g.
  the user installs a suggested file), the caller rebuilds the context and calls
  the function again - that is the whole "loop".
- `FileRequirementsContext` / `FileRequirementsReport` in [`src/types.ts`](src/types.ts) - schema TBD (depends on LAZ-472).

## Data we expect to need (per dependency target)

Minimal draft contract for what the backend should return for each dependency,
so the resolver can match, decide, link and download. Display fields exist in
`IFileInfo`/`IModInfo` today.

| Field                 | Type             | Group        | Purpose                                                                                        |
| --------------------- | ---------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `fileUid`             | string           | identity     | Match the target against the user's installed files                                            |
| `requiredBy`          | string (fileUid) | identity     | Which installed file pulls this dep in (grouping + nested traversal)                           |
| `acceptableFileUids?` | string[]         | satisfaction | Set that satisfies the requirement (materialized update group) -> decides satisfied vs missing |
| `kind`                | enum             | satisfaction | `requires` / `recommends` (severity + whether it blocks)                                       |
| `gameDomain`          | string           | download     | Part of the `nxm://` URL and the mod/file links                                                |
| `modId`               | number           | download     | Part of the `nxm://` URL and the mod/file links                                                |
| `fileId`              | number           | download     | Part of the `nxm://` URL; deep-links to the correct file version                               |
| `availability`        | enum             | download     | available / deleted / archived / hidden -> suppress download of dead files                     |
| `category`            | enum             | download     | main / optional / old / etc.                                                                   |
| `sizeBytes`           | number           | download     | "Download all" size estimate / disk check                                                      |
| `fileName`            | string           | display      | File row label                                                                                 |
| `version`             | string           | display      | File version label                                                                             |
| `modName`             | string           | display      | Mod label + link text                                                                          |
| `modSummary`          | string           | display      | Mod blurb                                                                                      |
| `thumbnailUrl`        | string           | display      | Mod tile image                                                                                 |
| `adultContent`        | boolean          | display      | Content gating                                                                                 |

Notes:

- External / DLC requirements ride the same shape, with `availability` flagging
  them non-downloadable (no `nxm://`); they render informational-only.
- Mod page URL and file page URL are **derived** from `gameDomain` + `modId` +
  `fileId`, so they are not separate fields.

## Using it from Vortex

This is a pnpm workspace package, so it is consumed by name with a `workspace:*`
range - never imported by relative path.

It is **already wired into the renderer**: `@nexusmods/file-dependency-resolver`
is in `src/renderer/package.json`, which is where the health-check extension
lives (`src/renderer/src/extensions/health_check/` is bundled into the renderer
and has no `package.json` of its own). So just run `pnpm install` from the repo
root, then import by package name:

```ts
import { checkFileLevelRequirements } from "@nexusmods/file-dependency-resolver";
import type { FileRequirementsContext } from "@nexusmods/file-dependency-resolver";

// e.g. inside the mod requirements health check
// (src/renderer/src/extensions/health_check/checks/modRequirementsCheck.ts)
const context: FileRequirementsContext = {
    // TODO: build from Vortex state + the batch dependency API response
    //  - gameDomain for the active game
    //  - installedFiles (fileUid / modId / fileId / version from mod.attributes)
    //  - requirements returned by the backend
};

const report = checkFileLevelRequirements(context);
// map report.missing -> IModMissingRequirements / health-check page rows,
// and turn each missing target into an nxm:// download via onDownloadRequirement.
// When the user installs a suggested file, the ModsChanged trigger re-runs the
// check with the new install set - no loop inside the module.
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
