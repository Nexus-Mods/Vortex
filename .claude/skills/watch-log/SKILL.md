---
name: watch-log
description: Watch or investigate a Vortex log file (rotation- and session-aware). A router over six modes loaded on demand — live tail, session/crash/error investigation, persistence (duckdb/level_pivot) integrity, log-line-to-code correlation, single download/install/collection/deploy trace, and a collection-install audit (also serves as the LAZ-483 regression check). Defaults to the dev log; can target prod or a specific file.
when_to_use: When the user wants to watch/tail/follow a log live, or investigate/report on errors, crashes, warnings, persistence integrity, re-installs, version downgrades, a specific log entry, or a download/install/collection/deployment lifecycle in a Vortex log.
user-invocable: true
---

# `/watch-log` (router)

Watch or investigate a Vortex log file. The log is rotation-aware and session-aware:
it rolls at ~11 MB into `vortex1.log`, `vortex2.log`, … so one run can span several
files and one file can hold several runs. This skill is a **thin router**: it picks
the mode(s) and loads only the files needed, keeping context small.

## How to run

1. **Always read `reference.md`** (the core) first — the universal log facts, the
   dev/prod/rotation log-set resolver, and an index of the on-demand `shared/` chunks
   (sessions, lifecycle, persistence, multi-file, edge-cases) that modes load as needed.
2. **Pick the mode(s)** from `$ARGUMENTS` using the table below. **More than one mode
   may be requested in a single invocation** (e.g. "investigate + persistence", or
   "trace <mod> and correlate <error>").
3. **For each selected mode, read its file** under `modes/` plus the `shared/` chunks
   named in that mode's Prereq line, and follow it. Read `reference.md` and each chunk
   at most once, even when running several modes.
4. **Running several modes:** if they're independent (the common case), you may run
   them concurrently — e.g. dispatch each mode to its own subagent (pass it
   `reference.md` + the mode file + the resolved log target), then combine the
   results into one report with a section per mode. If a mode depends on another's
   output (rare), run them in order. Resolve the log set **once** (per `reference.md`)
   and share the target across all selected modes.

## Mode picker

| Mode                         | Trigger (`$ARGUMENTS`)                                                                                                                                                          | File                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Live**                     | default, or _watch / live / follow / tail / monitor_                                                                                                                            | `modes/live.md` (§A)               |
| **Investigate**              | _investigate / analyze / report / crashes / errors / warnings / session / "what happened"_, or a date/session ref                                                               | `modes/investigate.md` (§B)        |
| **Persistence**              | _persist / persistence / duckdb / level_pivot / slow write / did it save_                                                                                                       | `modes/persistence.md` (§C)        |
| **Correlate**                | a pasted/quoted specific log line, or _correlate / why did this happen_                                                                                                         | `modes/correlate.md` (§D)          |
| **Trace**                    | _trace / track / follow this install / download / collection / deployment_, or a mod id / archive name / nxm url / downloadId / collection name                                 | `modes/trace.md` (§E)              |
| **Collection install audit** | _collection install audit / member stuck / requeue loop / did the collection finish / install completion / settled / interrupted install / resume / data loss on restart / 483_ | `modes/collection-install.md` (§F) |

**Trace vs Collection install audit:** §E follows one entity and reports where it
stalled; §F audits a whole collection install against the install-completion invariants
(every member terminal, no requeue loop, phases advance, error paths settle) and names
which invariant broke. Use §F to audit a whole install's health (this doubles as the
LAZ-483 regression check), §E to chase one thread.

If no mode is implied, default to **Live**. If a request clearly spans several
(e.g. "give me the full picture of this session and its persistence"), select and
run all that apply.
