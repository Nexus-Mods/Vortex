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

- Never bypass phase gating, even for optional/recommended mods
- Check BOTH `active === 0` AND `pending === 0` before deployment
- Always set `isDeploying` during deployment, clear it after
- Call `startPendingForPhase()` after deployment completes

## Test Files

- `__tests__/PhasedInstaller.test.ts` - Phase advancement logic
