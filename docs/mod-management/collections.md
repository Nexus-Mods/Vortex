# Collections and Phased Installation

How a collection installs: what a phase is, what has to be true before the next
one starts, and the invariants to preserve when changing the phase logic.

## Concept

Collections are curated mod sets that install in phases. Each phase must
complete and deploy before the next begins:

- Phase 0: framework mods (SMAPI, for example)
- Phase 1 and up: content mods depending on earlier phases
- `OPTIONAL_PHASE`: a dedicated trailing phase for optional and recommended
  mods, which install through the same engine as required members, just last

## Key Files

- `src/renderer/src/extensions/mod_management/InstallManager.ts` - The phase
  engine. Its header comment documents the phase lifecycle and the
  `mInstallPhaseState` structure in detail; read that before changing anything
  here.
- `src/renderer/src/extensions/mod_management/util/InstallPhaseTracker.ts` -
  Tracks which phases a collection actually has (`collectionRulePhases`)
- `src/renderer/src/extensions/mod_management/util/rulePhase.ts` - Maps a
  collection rule to its phase, including the `OPTIONAL_PHASE` sentinel
- `src/renderer/src/extensions/mod_management/util/requeueCandidates.ts` -
  Decides what gets requeued when a phase is retried

## Phase lifecycle

```
downloads for phase N finish
  └─ markPhaseDownloadsFinished()
       └─ maybeAdvancePhase()
            ├─ active === 0 AND pending === 0 for phase N?
            │    no ──> wait
            └─ yes ──> pollPhaseSettlement()
                        └─ deploy (isDeploying = true)
                             └─ deployment done (isDeploying = false)
                                  └─ startPendingForPhase(N+1)
```

The completion poll (`pollAllPhasesComplete`) also calls
`driveSelectedOptionals` on each tick, which is how an optional un-ignored after
the initial gather still gets installed.

## Critical rules

When modifying phase logic:

- **Never bypass phase gating, even for optional or recommended mods.** Optionals
  map to the trailing `OPTIONAL_PHASE` via `rulePhase` and install through the
  same phase engine as required members. There is no separate optional round.
- **A selected optional un-ignored after the initial gather is never in that
  pass**, so the completion poll re-drives it: `driveSelectedOptionals` (called
  each `pollAllPhasesComplete` tick) downloads or imports the pending optional,
  then `handleDownloadFinished` queues its install at `OPTIONAL_PHASE`.
- The dialog's "Install optional mods" (`InstallDriver.installRecommended`)
  clears `ignored` and re-runs the normal `install-dependencies` pass. It does
  **not** use `installRecommendationsImpl`, which stays for general
  non-collection mod recommendations.
- **Phase-set backfill** (marking earlier phases finished) iterates the
  collection's real phases (`collectionRulePhases` via `InstallPhaseTracker`),
  never integer `0..phase`. Iterating integers would enumerate the
  `OPTIONAL_PHASE` sentinel.
- **Check both `active === 0` and `pending === 0`** before deploying.
- **Always set `isDeploying` during deployment and clear it after.** Removing
  this guard causes race conditions: new installs during deployment produce file
  conflicts.
- **Call `startPendingForPhase()` after deployment completes**, or queued
  installs for the next phase never start.

## Tests

- `InstallManager.optionalPhaseGate.test.ts` - Optional-phase gating
- `InstallManager.optionals.test.ts` - Optional mod handling
- `util/InstallPhaseTracker.test.ts` - Phase tracking
- `util/rulePhase.test.ts` - Rule-to-phase mapping

All under `src/renderer/src/extensions/mod_management/`.

## See also

- [EXTERNAL-CHANGES.md](EXTERNAL-CHANGES.md) - The External Changes dialog, which
  deployment can trigger
