---
name: watch-log
description: Watch or investigate a Vortex log file (rotation- and session-aware). A router over six modes loaded on demand — live tail, session/crash/error investigation, persistence (duckdb/level_pivot) integrity, log-line-to-code correlation, single download/install/collection/deploy trace, and a collection-install audit (also serves as the LAZ-483 regression check). Defaults to the dev log; can target prod or a specific file. When the request is too vague to route, it interviews the user (goal, symptom, timeframe, whose log) before running anything.
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
2. **Run the triage gate** (below): if the request is underspecified, interview the
   user before picking anything — do not guess a mode.
3. **Pick the mode(s)** from `$ARGUMENTS` (plus any triage answers) using the table
   below. **More than one mode may be requested in a single invocation** (e.g.
   "investigate + persistence", or "trace <mod> and correlate <error>").
4. **For each selected mode, read its file** under `modes/` plus the `shared/` chunks
   named in that mode's Prereq line, and follow it. Read `reference.md` and each chunk
   at most once, even when running several modes.
5. **Running several modes:** if they're independent (the common case), you may run
   them concurrently — e.g. dispatch each mode to its own subagent (pass it
   `reference.md` + the mode file + the resolved log target), then combine the
   results into one report with a section per mode. If a mode depends on another's
   output (rare), run them in order. Resolve the log set **once** (per `reference.md`)
   and share the target across all selected modes.

## Triage gate — detect an underspecified request

Mode triggers only work when the user knows what they want. Many users don't: they
attach a log with "help", "it's broken", "check this", or describe a symptom with no
target. Guessing a mode for such a request produces a confident report about the wrong
thing — worse than asking. Gate every request first.

A request is **underspecified** when it has **neither**:

- a mode trigger from the table below, **nor**
- a concrete target: an entity (mod / collection / download / game), a pasted log line,
  a session/date/time, or a described symptom (crash, stuck install, slow saves, …).

It is **also** underspecified when the trigger and the story **contradict** (e.g.
"tail the log" but the complaint is about yesterday's crash — the goal wins over the
trigger word), or when the ask is something a log cannot answer (fix a mod, refund,
account issues) — say so plainly instead of producing a report.

**When underspecified: stop and interview.** Do not default to Live, do not run every
mode hoping one hits, and do not silently substitute a guess for a missing answer. Ask
in one compact message, numbered so they can answer inline:

1. **What are you trying to find out?** (why Vortex crashed / why a mod or collection
   didn't install / whether my settings-mods saved / is this error known / just watch it
   run)
2. **What happened, and when?** What were you doing at the time; roughly which
   day/time. "It's broken" is not an answer — ask what they saw.
3. **Whose Vortex / which log?** Their own installed Vortex (prod), a dev build, or a
   log someone sent them. An attached file is almost always someone's prod log.
4. **What does a good answer look like?** (a yes/no verdict, a timeline, the guilty
   code, a report they can forward)

Then map the answers onto mode(s) via the table, **restate the plan in one line**
("I'll investigate the latest session of the attached prod log to explain the crash")
and run. If the answers are still vague after one round, list the six modes in plain
language and ask them to pick one; keep asking rather than guessing — one more question
round is cheaper than a wrong-mode report. Bare `/watch-log` from a developer with a
resolvable local dev log is NOT underspecified — that is the legitimate Live default.

## Mode picker

| Mode                         | Trigger (`$ARGUMENTS`)                                                                                                                                                          | File                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Live**                     | default, or _watch / live / follow / tail / monitor_                                                                                                                            | `modes/live.md` (§A)               |
| **Investigate**              | _investigate / analyze / report / crashes / errors / warnings / session / "what happened"_, or a date/session ref                                                               | `modes/investigate.md` (§B)        |
| **Persistence**              | _persist / persistence / duckdb / level_pivot / slow write / did it save_                                                                                                       | `modes/persistence.md` (§C)        |
| **Correlate**                | a pasted/quoted specific log line, or _correlate / why did this happen / is this already fixed_                                                                                 | `modes/correlate.md` (§D)          |
| **Trace**                    | _trace / track / follow this install / download / collection / deployment_, or a mod id / archive name / nxm url / downloadId / collection name                                 | `modes/trace.md` (§E)              |
| **Collection install audit** | _collection install audit / member stuck / requeue loop / did the collection finish / install completion / settled / interrupted install / resume / data loss on restart / 483_ | `modes/collection-install.md` (§F) |

**Trace vs Collection install audit:** §E follows one entity and reports where it
stalled; §F audits a whole collection install against the install-completion invariants
(every member terminal, no requeue loop, phases advance, error paths settle) and names
which invariant broke. Use §F to audit a whole install's health (this doubles as the
LAZ-483 regression check), §E to chase one thread.

If no mode is implied, default to **Live** only when the triage gate passed (a bare
invocation against a live local log dir); with attached/foreign files or a vague ask,
the gate applies — interview, don't tail. If a request clearly spans several modes
(e.g. "give me the full picture of this session and its persistence"), select and
run all that apply.
