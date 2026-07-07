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
