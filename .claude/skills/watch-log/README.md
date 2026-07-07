# `/watch-log` — Vortex log skill (overview & usage)

A Claude Code skill for watching and investigating **Vortex log files**. It turns a
noisy, multi-megabyte log into a short, session-scoped diagnosis: how the app
terminated, what errors/warnings fired, whether persistence wrote cleanly, where an
install/download/collection stalled, and which line of code emitted a given entry.

It is **rotation-aware** (logs roll at ~11 MB into `vortex1.log`, `vortex2.log`, …) and
**session-aware** (one file can hold several app runs; one run can span several files).

## Install

Unzip into your Claude Code skills directory so the folder lands at
`.claude/skills/watch-log/` (either the repo's `.claude/` or your user-level
`~/.claude/`). Restart/reload Claude Code and the `/watch-log` skill becomes available.

## How it works (architecture)

It is a **thin router**. `SKILL.md` reads a small core (`reference.md`) and then loads
**only** the mode(s) and shared chunks a given request needs, keeping context small.

```
watch-log/
  SKILL.md            router: picks the mode(s) from your request
  reference.md        core facts: log format, dev/prod/rotation resolver, chunk index
  modes/              one file per mode, loaded on demand
  shared/             reusable chunks (sessions, lifecycle, persistence, …)
  drift-check/        WIP, not wired into the router — ignore for evaluation
```

## The six modes

| Mode                         | What it does                                                                                                                                                                                                                                                            | Trigger words                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Live**                     | Streams matching log lines into chat in real time (no-timeout monitor).                                                                                                                                                                                                 | _watch / live / follow / tail / monitor_ (also the default)                                                         |
| **Investigate**              | Session-scoped report: termination state (clean / killed-during-exit / hard-crash / in-progress), error & warning signatures, most error-prone session, regressions, re-installs, version downgrades.                                                                   | _investigate / analyze / report / crashes / errors / warnings / session_                                            |
| **Persistence**              | Checks duckdb/`level_pivot` writes for failures, wedged (never-confirmed) writes, and slow writes.                                                                                                                                                                      | _persistence / duckdb / level_pivot / slow write / did it save_                                                     |
| **Correlate**                | Takes a specific log line and finds the emitting call site, then walks the code bidirectionally (callers/callees) to a set depth.                                                                                                                                       | a pasted/quoted log line, or _correlate / why did this happen_                                                      |
| **Trace**                    | Follows one download / mod install / collection / deployment top-to-bottom: phase timeline, durations, outcome, where it stalled.                                                                                                                                       | _trace / track / follow this install_, or a mod id / archive name / nxm url / collection name                       |
| **Collection install audit** | Audits a whole collection install against the install-completion invariants (every member terminal, no requeue loop, phases advance, disk-full/failed-download/orphaned-archive paths settle, interrupted installs resume without data loss) and names which one broke. | _collection install audit / member stuck / requeue loop / did the collection finish / interrupted install / resume_ |

More than one mode can run in a single request (e.g. "investigate this session and check
its persistence").

## Which log it reads

By default it scans the **dev** log set (`%APPDATA%\@vortex\main\`). You can point it at
**prod** (`%APPDATA%\Vortex\`) with the `prod` keyword, or at a **specific file path**.
It always states which directory/file it chose and resolves the rolled-file set once.

> Note: those default paths are specific to the Vortex dev workflow. On a different
> setup, adjust the resolver in `reference.md`.

## Example prompts

- `/watch-log` — live-tail the dev log (default mode)
- `/watch-log investigate` — report on the latest dev session (crashes, errors, warnings)
- `/watch-log investigate prod, all sessions` — full prod history with cross-session signals
- `/watch-log persistence` — did the last writes commit, or did any wedge / run slow?
- `/watch-log trace "Skyrim Script Extender"` — follow that mod's install lifecycle
- `/watch-log 483 — did the collection finish?` — collection install audit
- paste a log line + `why did this happen?` — correlate it back to the emitting code

## What it does _not_ do

- It does not modify logs or app state — it is read-only analysis.
- It is tuned to Vortex's log markers and collection-install invariants; it is not a
  general-purpose log tool.
- The `drift-check/` folder is an in-progress experiment and is not part of the routed
  skill behaviour.
