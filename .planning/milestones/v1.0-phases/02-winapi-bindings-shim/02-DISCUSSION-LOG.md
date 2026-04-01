# Phase 2: winapi-bindings Shim - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 02-winapi-bindings-shim
**Areas discussed:** Main process shim scope

---

## Main Process Shim Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Rolldown alias — same shim | Add resolve.alias to rolldown.base.mjs pointing winapi-bindings → same shim file. One shim covers all 18 import sites. | ✓ |
| Inline platform guards | Leave rolldown config untouched. Add if (process.platform !== 'linux') guards in main.ts and Application.ts. | |
| Separate main shim file | Create a second shim for main process, keep renderer and main shims separate. | |

**User's choice:** Rolldown alias — same shim (recommended default)
**Notes:** One shim file at `src/renderer/src/util/winapi-shim.ts` aliased in both webpack and rolldown configs.

---

## Shim File Location

| Option | Description | Selected |
|--------|-------------|----------|
| src/renderer/src/util/winapi-shim.ts | Per WAPI-01 spec. Webpack alias resolves relative to webpack config. Rolldown uses absolute path. | ✓ |
| src/shared/src/util/winapi-shim.ts | Placed in shared package for natural imports from both renderer and main. | |
| src/main/src/util/winapi-shim.ts with renderer symlink | Live in main, referenced by rolldown; webpack uses absolute path. | |

**User's choice:** `src/renderer/src/util/winapi-shim.ts` (recommended default, per WAPI-01)
**Notes:** Both webpack and rolldown alias to this location via absolute path.

---

## Claude's Discretion

- Exact shape of `GetVolumePathName` Linux implementation (`stat.dev` walk vs dirname approximation)
- Exact error type thrown by `ShellExecuteEx` stub
- `RegGetValue` stub shape (throw vs return null)
- How to thread the conditional alias into rolldown `createConfig()`
- Export style to cover both default and namespace import patterns

## Deferred Ideas

None.
