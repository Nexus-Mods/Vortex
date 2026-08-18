# `/watch-log` — Vortex log skill (overview & usage)

A Claude Code skill for watching and investigating **Vortex log files**. It turns a
noisy, multi-megabyte log into a short, session-scoped diagnosis: how the app
terminated, what errors/warnings fired, whether persistence wrote cleanly, where an
install/download/collection stalled, and which line of code emitted a given entry.

It is **rotation-aware** (logs roll at ~11 MB into `vortex1.log`, `vortex2.log`, …) and
**session-aware** (one file can hold several app runs; one run can span several files).
Attached/foreign copies with scrambled names are re-linked into one rotation set when
they share an `instanceId` (a fresh re-install mints a new id, so no match ≠ unrelated).

## Install

**Claude Code:** unzip into your skills directory so the folder lands at
`.claude/skills/watch-log/` (either the repo's `.claude/` or your user-level
`~/.claude/`). Restart/reload Claude Code and the `/watch-log` skill becomes available.

**claude.ai (no local checkout needed):** upload the zip via Customize > Skills >
"+" > Upload a skill. To roll it out org-wide on a Team/Enterprise workspace, an org
owner uploads the same zip under Organization settings > Skills (requires "Code
execution and file creation" and "Skills" enabled there); it then appears for every
member under Organization skills. In a chat, attach the log files
(`%APPDATA%\Vortex\vortex*.log`, excluding `network.log`) — the correlate mode
fetches the source it needs from GitHub by itself.

## How it works (architecture)

It is a **thin router**. `SKILL.md` reads a small core (`reference.md`) and then loads
**only** the mode(s) and shared chunks a given request needs, keeping context small.

```
watch-log/
  SKILL.md            router: picks the mode(s) from your request
  reference.md        core facts: log format, dev/prod/rotation resolver, chunk index
  modes/              one file per mode, loaded on demand
  shared/             reusable chunks (sessions, lifecycle, persistence, …)
```

(A `drift-check/` folder exists in the source tree — a dev-side tool that greps the
Vortex checkout to detect marker drift. It is not wired into the router and is not
part of the distribution zip.)

## The six modes

| Mode                         | What it does                                                                                                                                                                                                                                                                                                                                                    | Trigger words                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Live**                     | Streams matching log lines into chat in real time (no-timeout monitor).                                                                                                                                                                                                                                                                                         | _watch / live / follow / tail / monitor_ (also the default)                                                         |
| **Investigate**              | Session-scoped report: termination state (clean / killed-during-exit / hard-crash / in-progress), error & warning signatures, most error-prone session, regressions, re-installs, version downgrades.                                                                                                                                                           | _investigate / analyze / report / crashes / errors / warnings / session_                                            |
| **Persistence**              | Checks duckdb/`level_pivot` writes for failures, wedged (never-confirmed) writes, and slow writes.                                                                                                                                                                                                                                                              | _persistence / duckdb / level_pivot / slow write / did it save_                                                     |
| **Correlate**                | Takes a specific log line and finds the emitting call site, then walks the code bidirectionally (callers/callees) to a set depth. Scans current code by default and flags entries whose log line no longer exists as possibly fixed; pins to the log's release tag on request. Clones the repo when there is no local checkout.                                 | a pasted/quoted log line, or _correlate / why did this happen / is this already fixed_                              |
| **Trace**                    | Follows one download / mod install / collection / deployment top-to-bottom: phase timeline, durations, outcome, where it stalled.                                                                                                                                                                                                                               | _trace / track / follow this install_, or a mod id / archive name / nxm url / collection name                       |
| **Collection install audit** | Audits a whole collection install against the install-completion invariants (every member terminal, no requeue loop, phases advance, disk-full/failed-download/orphaned-archive paths settle, interrupted installs resume without data loss), names which one broke, and states whether the collection is **fully installed** (installed count vs `totalMods`). | _collection install audit / member stuck / requeue loop / did the collection finish / interrupted install / resume_ |

More than one mode can run in a single request (e.g. "investigate this session and check
its persistence").

**Release currency:** on prod/attached logs it resolves the latest stable and beta
releases from the `Nexus-Mods/Vortex` GitHub tags and checks every session's version
against them (a rolled set can hide a current session in an old-looking file, and sets
can contain upgrades/downgrades - it never judges by file date). If no session is
current it warns that the logs are old and probably not actionable, and asks before
digging in. Dev builds log version `1.0.0` and are always treated as current.

**Guided triage:** a vague request ("help", "it's broken", a bare attached log) is not
guessed at — the skill asks a short set of questions first (what are you trying to find
out, what happened and when, whose log is this, what does a good answer look like),
restates its plan in one line, and only then runs. If the goal and the wording conflict
("tail the log" about yesterday's crash), the goal wins and it asks. You get better
reports by describing the symptom and the time it happened than by naming a mode.

## Which log it reads

By default it scans the **dev** log set (`%APPDATA%\@vortex\main\`). You can point it at
**prod** (`%APPDATA%\Vortex\`) with the `prod` keyword, or at a **specific file path**.
It always states which directory/file it chose and resolves the rolled-file set once.

> Note: those default paths are specific to the Vortex dev workflow. On a different
> setup, adjust the resolver in `reference.md`. Where no local Vortex install exists
> (e.g. running the skill in a claude.ai chat), it reads log files attached to the
> conversation instead.

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
