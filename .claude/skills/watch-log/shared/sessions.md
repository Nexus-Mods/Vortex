# Shared chunk — sessions (boundaries, termination, scoping)

Load when a mode reasons about sessions: investigate (§B), trace (§E),
collection-install (§F). Holds the session facts; the per-mode procedure stays in the
mode file.

## Session boundary markers

- **Start anchor:** `[INFO] [MAIN] Vortex Version "…"` (preceded by an
  `[INFO] [MAIN] --------------------------` separator line). The quoted value is the
  **app version** for that session.
- `[DEBG] [MAIN] startup instance {"instanceId":"…"}` carries the **instanceId**.
- **Shutdown markers:** `[INFO] [MAIN] Vortex closing` (exit initiated) →
  `[INFO] [MAIN] clean application end` (exit completed).

## Termination — a 4-state classification (don't collapse to clean-vs-crash)

- **Clean** — `Vortex closing` followed by `clean application end`.
- **Killed during exit** — `Vortex closing` present but **no** `clean application end`
  before the next start / EOF. Typical of a dev stop, restart, or debugger-kill; common
  in dev logs (which often never emit `clean application end`). Not a hard crash.
- **Hard crash / abrupt** — **no** `Vortex closing` at all; the session just ends
  mid-activity (or at the next start). This is the real crash signal.
- **In progress** — latest session, no shutdown markers, app still running.

Prod sessions normally reach `clean application end`; dev sessions frequently stop at
`Vortex closing` — weight the signal accordingly per dir.

## instanceId semantics

From the `startup instance` line. Use the start/end markers (not instanceId) to delimit
sessions. On **prod** it is stable across restarts of the same install, so a **change**
between sessions means a **re-install / fresh install** — track and highlight it. On
**dev** it churns (a new id can be minted per test run), so treat changes as noise.
A shared instanceId across **differently named foreign files** marks them as
potentially one install's rolled set — see `shared/multi-file.md`.

## Release currency (stale-log gate)

Old logs are usually not worth deep analysis: the code has moved on and the bug may be
fixed. Right after enumerating sessions (and before the deep dive), on **prod or
foreign** logs, check the log's versions against the latest releases. Skip this on the
**dev** dir - the dev log is by definition the current rig.

**Dev-build marker:** a session logging `Vortex Version "1.0.0"` is ALWAYS a dev build
(the dev rig's placeholder version), wherever the file came from. Treat such sessions
as current, never as "version 1.0.0 from 2019".

1. **Resolve the latest releases** from the GitHub tags/releases of `Nexus-Mods/Vortex`
   (tags are `vX.Y.Z` and `vX.Y.Z-beta.N`; ignore non-version tags like `backup/*`):
    - `gh release list -R Nexus-Mods/Vortex --limit 15` - latest **stable** = the row
      marked `Latest`; latest **beta** = the newest `Pre-release` row, and it only
      counts while it is newer than the stable (a stable release supersedes the betas
      below it).
    - No `gh`/checkout (e.g. claude.ai sandbox): fetch
      `https://api.github.com/repos/Nexus-Mods/Vortex/releases?per_page=15`
      (`prerelease` flag + `tag_name`).
    - If neither source is reachable, say the currency check was skipped - do not guess.
2. **Compare per session, across the whole resolved set.** Each session's quoted
   `Vortex Version` (no `v` prefix) is the unit of comparison - never the file's mtime
   or name. A rolled/foreign set can mix versions (upgrades AND downgrades mid-set),
   and an old-looking file can still contain a current session, so check every session
   in the set before judging.
3. **Verdict:** the set is **current** if any session runs the latest stable, the
   latest beta, a newer (unreleased) version, or the `1.0.0` dev marker. Otherwise
   tell the user plainly: the logs are **old** (name the newest version found vs
   latest stable/beta) **and probably not actionable** - the code has changed and
   findings may already be fixed - then ask whether to continue anyway. Continue if
   they say so; never hard-refuse.
4. Even in a current set, label findings from outdated sessions with that session's
   version (per the reporting rule below) - a finding from an old-version session
   carries the same "may already be fixed" caveat.

## Scoping to one session

The latest session lives at the **tail of the current `vortex.log`**: scan backward for
the last start anchor; that anchor → EOF is the latest session. Only reach into
`vortex1.log` (then `vortex2.log`, …) when the start anchor is **not** in `vortex.log`
(the session began before the last roll), so the session stays contiguous, or when the
user wants older / all sessions (then assemble files oldest→newest, see the resolver in
`reference.md`).

## Edge case

- **Session start scrolled out of retained logs** (oldest file begins mid-session):
  note "session start not in retained logs; window is partial".
