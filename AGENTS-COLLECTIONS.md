# Collections & Phased Installation

## Concept

Collections are curated mod sets that install in phases. Each phase must complete and deploy before the next begins:

- Phase 0: Framework mods (e.g., SMAPI)
- Phase 1+: Content mods depending on previous phases

## Key File

`src/extensions/mod_management/InstallManager.ts`

Read the source code comments on `mInstallPhaseState` for critical invariants.

## Key Methods

- `ensurePhaseState()` - Initialize phase tracking
- `markPhaseDownloadsFinished()` - Mark phase ready for installation
- `maybeAdvancePhase()` - Attempt to advance to next phase
- `pollPhaseSettlement()` - Coordinate deployment timing
- `startPendingForPhase()` - Resume queued installations after deployment

## Critical Rules

When modifying phase logic:

- Never bypass phase gating, even for optional/recommended mods. Optionals map to the dedicated
  trailing `OPTIONAL_PHASE` (`rulePhase`) and install through the same phase engine as required
  members, just last. There is no separate optional round.
- A selected optional un-ignored AFTER the initial gather is never in the pass, so the completion
  poll re-drives it: `driveSelectedOptionals` (called each `pollAllPhasesComplete` tick) downloads
  or imports the pending optional, then `handleDownloadFinished` queues its install at
  `OPTIONAL_PHASE`. The dialog's "Install optional mods" (`InstallDriver.installRecommended`) clears
  `ignored` and re-runs the normal `install-dependencies` pass - it does NOT use the separate
  `installRecommendationsImpl` (that stays for general, non-collection mod recommendations).
- Phase-set backfill (marking earlier phases finished) iterates the collection's real phases
  (`collectionRulePhases` via `InstallPhaseTracker`), never integer `0..phase` - that would enumerate
  the `OPTIONAL_PHASE` sentinel.
- Check BOTH `active === 0` AND `pending === 0` before deployment
- Always set `isDeploying` during deployment, clear it after
- Call `startPendingForPhase()` after deployment completes

## Test Files

- `__tests__/PhasedInstaller.test.ts` - Phase advancement logic
