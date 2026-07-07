# §F — Collection install audit

Prereq: `reference.md` (core) + `shared/lifecycle.md` + `shared/sessions.md`. This mode
extends §E (trace): §E threads one entity and reports where it stalled; §F audits a
**whole collection install** against the install-completion invariants and names which
one broke. Scope to one session (default latest, per §B); say which.

A healthy collection install holds a set of invariants: collection state lives in the
session SSOT (`state.session.collections`, written by `collectionSessionWrite` /
`InstallManager`), every member reaches a terminal state, phases advance, and the error
paths settle members instead of wedging them. This mode confirms that from the log and
flags the specific failure modes so a problem surfaces as a **named check, not a
mystery**. These invariants are the contract LAZ-483 established, so the same audit
doubles as the **483 regression check** when you run it against a dev collection install.

Confirm the message strings below still exist before relying on absence (grep the
source named in each row); log text drifts.

## Identify the collection

From `$ARGUMENTS`: a collection name/id, or "the collection install". If none, grep the
scoped log for `starting install of collection` and list candidates (with `collationId`
and `totalMods`) for the user to pick. Thread members by `modId` / `referenceTag` /
`collationId` and the `sourceModId` (= collection id) carried on the install logs.

## Envelope (the collection-level lifecycle)

- `starting install of collection {totalMods, missing}` (InstallDriver) — start anchor.
- `did install dependencies {modId}` (InstallDriver) — dependencies phase done.
- `add collection rule` (postprocessCollection) — rules applied.
- `postprocess collection` (postprocessCollection) — terminal success anchor.
- Pause/resume: `pause collection` / `resume collection` / `failed to pause collection`
  / `User logged out during collection install, pausing` (collections/index.ts).
- `already installing a collection` (InstallDriver) — a second install was refused.

## Per-member lifecycle (each dependency)

Generic install markers (`shared/lifecycle.md`, used by §E): `start mod install` → `installing to {modId,
destinationPath}` → `extracting mod archive` → `invoking installer` → `finish mod
install {outcome}` → `Installation completed successfully {installId, modId, duration}`.
Collection hand-off: `Found collection for download` / `Found collection for failed
download` (InstallManager). The SSOT status writes (`{type:"status", status:
"downloaded"|"failed"|...}`) go to the session hive, not a log string — observe them via
the install lifecycle logs above and, if needed, the `persist:diff {hive:"session"}`
arrivals (§C markers).

## Invariants to assert (and the bug signature if broken)

| #   | invariant (what a healthy install holds)                                                          | broken signature in the log                                                                                                                                                                                                                                                                                               | source                                                 |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | every member reaches a terminal state (installed or failed)                                       | `Called callback for stuck installation` (a member wedged on "installing"); or the stall-rescue flow firing: `Collection install stalled, attempting rescue` followed by `Collection install stalled after rescue attempt, resolving` (the installer force-resolved a stalled phase, so members may be left non-terminal) | InstallManager                                         |
| 2   | a failed download settles the member failed (and lets the phase advance)                          | `Found collection for failed download` with **no** following member-failed settle, or `Collection is not currently installing - ignoring download failure` firing while the collection _is_ installing                                                                                                                    | InstallManager `handleDownloadFailed`                  |
| 3   | no requeue loop                                                                                   | the same `modId` runs `start mod install` more than `MAX_DEPENDENCY_RETRIES` (3) times                                                                                                                                                                                                                                    | InstallManager (`MAX_DEPENDENCY_RETRIES`)              |
| 4   | disk-full ends the member terminally                                                              | extraction hits disk-full but the member neither completes nor logs a "Not enough disk space" terminal fail (failure mode: requeue → skip → stuck)                                                                                                                                                                        | InstallManager (`InsufficientDiskSpace`)               |
| 5   | an orphaned archive (file on disk, no download record) is reconciled before re-download           | a dependency download stalls with no `reconciling orphaned archive before download {fileName, gameId}` when one was on disk                                                                                                                                                                                               | `reconcileOrphanedArchive.ts`                          |
| 6   | the collection reaches postprocess                                                                | `starting install of collection` present but **no** `postprocess collection` / `did install dependencies` before session end (stuck phase); or `Error during scheduled phase deployment` (a phase failed to deploy, which can block advancing)                                                                            | InstallManager / InstallDriver / postprocessCollection |
| 7   | pause/resume and logout are clean                                                                 | a `pause collection` / logout-pause with no matching `resume collection`, or `failed to pause collection`                                                                                                                                                                                                                 | collections/index.ts                                   |
| 8   | progress stays sane                                                                               | a download/install progress value above 100 (the 101/100 `freeUserDownloadPosition` failure on the free-user path)                                                                                                                                                                                                        | InstallManager free-user path                          |
| 9   | an interrupted install loses no progress, and a user-initiated resume preserves completed members | a member that logged `Installation completed successfully` pre-restart is re-installed post-restart (progress lost); or a `resume collection` that re-runs completed members or fails to continue. Note: resume is **user-initiated**, so a parked install with **no** `resume collection` is not a failure               | session SSOT (`state.session.collections`)             |

### Stall, rescue, and critical-error signals

The installer has a stall-detection safety net; surface these whenever present:

- `Collection install stalled, attempting rescue {sourceModId}` (`[WARN]`) - a phase
  stalled (first timeout); a rescue is underway. Not yet a failure, but a warning sign.
- `Collection install stalled after rescue attempt, resolving {sourceModId}` (`[WARN]`)
    - the rescue did not unblock it (second timeout) and the installer **force-resolved**
      the phase. Members in that phase may be left non-terminal: pair with the per-member
      roll-up to see which, and report it as a stall (relates to invariant 1/6).
- `Critical error in dependency installation {downloadId, sourceModId}` (`[ERRO]`) - a
  dependency install threw; confirm the member settled `failed` rather than wedging.
- `Error during scheduled phase deployment {sourceModId}` (`[WARN]`) - a phase failed to
  deploy (relates to invariant 6).
- `Download not found when trying to resume {intendedId}` (`[WARN]`) - on resume an
  intended member download was missing; relevant to invariant 9 (resume integrity).

### Invariant 9 — interruption and resume (data-loss watch)

This is the core promise of the session SSOT (the guarantee LAZ-483 established): an
install interrupted by a restart/crash should resume from the session state without
redoing or losing completed members. **Always surface an interruption** (it is a real
signal), with this severity framing:

- **Detect interruption:** a `starting install of collection` whose session ends (next
  `Vortex Version` start anchor, or EOF with no `postprocess collection`) before the
  collection reaches `postprocess collection`.
- **Classify the boundary** using the termination classification from
  `shared/sessions.md` / §B: **clean** (`Vortex closing` → `clean application end`), **killed-during-exit**
  (`Vortex closing`, no clean end), **hard-crash** (no `Vortex closing`), or
  **in-progress** (latest session, still running).
- **Severity:**
    - **prod** (`$APPDATA/Vortex/`): flag every interruption as a finding. A hard-crash
      mid-install is a crash bug; a clean/killed exit mid-install is a resume-correctness
      and data-loss concern to track.
    - **dev** (`$APPDATA/@vortex/main/`): an interruption is **somewhat expected**
      (developer restarts the rig), so report it but label it expected, **unless the
      developer signals the restart was not intentional** (then treat it like prod, i.e. a
      real finding, especially a hard-crash).
- **Resume + lost-progress check:** in sessions after the boundary, look for
  `resume collection` (collections/index.ts) or a fresh `starting install of collection`
  for the same collection, and whether it reaches `postprocess collection`. Then compare
  member `modId`s with `Installation completed successfully` **before** the boundary
  against those re-running `start mod install` / completing **after** it:
    - members re-installed that were already complete pre-restart = **progress lost / data
      loss** (the SSOT did not preserve them) — flag regardless of dev/prod.
    - completed members correctly skipped on resume = SSOT preserved progress (pass).
    - **no `resume collection` attempted = parked, awaiting user resume — NOT a failure**
      (resume is user-initiated). Report it as parked/incomplete, not stuck.

**Prod monitoring.** On prod logs this invariant is the field signal for collection
install reliability: per interrupted install, report the boundary class, whether the
55-of-N style progress was preserved (no re-do) once resumed, and whether resume even
succeeded. A hard-crash boundary, or any re-installed-completed-member (data loss), is a
real finding to escalate; a clean exit with no resume attempt is benign.

Also surface the diagnostic "ignore" logs that mean a download event found no owner:
`No collection mod found for sourceModId`, `No active collection installation found`,
`No matching rule found in collection for download`, `Collection mod not found in
state`, `Skipping download failure - download not found`. A burst of these around a
member is a strong hint that invariant 1 or 2 is about to break.

## Steps

1. Resolve the log set and scope to the session (per §B). Find the collection envelope.
2. Build the **per-member roll-up**: for each member thread (`modId`), record its phase
   reached, outcome (completed / failed / **stuck**), `duration` if completed, and
   retry count (number of `start mod install` for that `modId`).
3. Walk the invariant table; for each break, cite the member, the matching line(s), and
   timestamps. Treat absence-of-terminal as **stuck** (invariant 1/6), not success.
4. Report the envelope outcome (reached `postprocess collection`?) and any pause/resume
   or logout transitions and whether they paired. If it did **not** reach postprocess,
   run invariant 9: find the session boundary that ended it, classify it (clean /
   killed-during-exit / hard-crash / in-progress), check later sessions for resume +
   lost-progress, and apply the dev/prod severity framing.
5. List interleaved `[ERRO]`/`[WARN]` whose payload references a member in its window.

## Output shape

- One-line verdict: collection completed / completed-with-failed-members / **stuck**,
  with member counts (installed / failed / stuck of total).
- Per-member table: `modId` · phase reached · outcome · duration · retries.
- Invariant results: each of 1-9 as pass / **FAIL** (with the offending lines), or n/a
  if the path wasn't exercised this session.
- Envelope timeline (start → did install dependencies → add rule → postprocess) with Δs,
  plus pause/resume/logout events.
- **Interruption (invariant 9), if any:** the boundary classification (clean / killed /
  hard-crash / in-progress), whether it resumed and reached postprocess, and the
  lost-progress verdict (members re-done vs preserved). State dev-expected vs a real
  finding per the severity framing; on prod always treat as a finding.
- Anything anomalous (requeue loops, stuck members, orphaned-archive stalls, >100
  progress, ignored-download bursts, data loss on resume).
