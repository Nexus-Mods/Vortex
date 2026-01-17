# Collections & Phased Installation

## Concept

Collections are curated mod sets that install in phases. Each phase must complete and deploy before the next begins:

- Phase 0: Framework mods (e.g., SMAPI)
- Phase 1+: Content mods depending on previous phases

## Architecture

The installation system has been refactored into modular components:

```
src/extensions/mod_management/
  InstallManager.ts          # Facade - delegates to orchestrator
  install/
    InstallOrchestrator.ts   # Coordinates all components
    PhaseManager.ts          # Phase state machine for collections
    InstallationTracker.ts   # Active/pending installation tracking
    ArchiveExtractor.ts      # 7z extraction with retry logic
    InstructionProcessor.ts  # Instruction validation and processing
    DependencyResolver.ts    # Dependency categorization utilities
    InstructionGroups.ts     # Instruction grouping by type
    helpers.ts               # Utility functions
    errors/                  # Error classification utilities
    types/                   # Type definitions and config
```

### Key Components

**InstallOrchestrator** (`install/InstallOrchestrator.ts`)
- Owns all extracted components
- Provides unified API for installation operations
- Coordinates between tracker, phase manager, extractor, and processor

**PhaseManager** (`install/PhaseManager.ts`)
- Manages phase state per collection (sourceModId)
- Tracks: allowedPhase, downloadsFinished, pending/active counts, deployedPhases
- Critical: `isDeploying` flag blocks new installs during deployment

**InstallationTracker** (`install/InstallationTracker.ts`)
- Tracks active installations (currently processing)
- Tracks pending installations (queued for phase)
- Provides cleanup for stuck installations

**DependencyResolver** (`install/DependencyResolver.ts`)
- `splitDependencies()` - Categorize into success/existing/error
- `groupDependenciesByPhase()` - Group by phase number
- Progress tracking and error summarization utilities

## Key Methods

In **InstallManager.ts**:
- `install()` - Main installation entry point
- `installDependencies()` - Install mod dependencies
- `pollPhaseSettlement()` - Coordinate deployment timing

In **PhaseManager.ts**:
- `ensureState()` - Initialize phase tracking for collection
- `getAllowedPhase()` / `setAllowedPhase()` - Phase gating
- `markDownloadsFinished()` - Mark phase ready for installation
- `isDeploying()` / `setDeploying()` - Deployment blocking
- `markPhaseDeployed()` - Record phase completion
- `queuePending()` / `drainPending()` - Pending install management

## Critical Rules

When modifying phase logic:

1. **DEPLOYMENT BLOCKING**: When `isDeploying` is true, new installations must be queued.
   Removing this check causes race conditions with file conflicts.

2. **PHASE COMPLETION CHECK**: Both `activeByPhase.get(phase) === 0` AND
   `pendingByPhase.get(phase).length === 0` must be true before phase can advance.

3. **PHASE GATING**: Even optional/recommended mods must wait for their phase.
   Never bypass phase gating - it breaks last-phase advancement logic.

4. **POST-DEPLOYMENT**: Always call `startPendingForPhase()` after deployment
   completes to resume any installations that were queued during deployment.

## Configuration

Installation configuration is centralized in `install/types/IInstallConfig.ts`:

```typescript
interface IInstallConfig {
  concurrency: {
    maxSimultaneousInstalls: 5,
    maxDependencyInstalls: 10,
    maxDependencyDownloads: 10,
    maxRetries: 3,
  },
  timing: {
    notificationAggregationMs: 5000,
    retryDelayMs: 1000,
    pollIntervalMs: 500,
    // ...
  },
  cleanup: {
    stuckInstallMaxAgeMinutes: 10,
  },
}
```

## Test Files

- `__tests__/mod_management/install/PhaseManager.test.ts` - Phase state machine
- `__tests__/mod_management/install/InstallationTracker.test.ts` - Installation tracking
- `__tests__/mod_management/install/InstallOrchestrator.test.ts` - Orchestrator coordination
- `__tests__/mod_management/install/DependencyResolver.test.ts` - Dependency utilities
- `__tests__/mod_management/install/ArchiveExtractor.test.ts` - Extraction with retry
- `__tests__/mod_management/install/InstructionProcessor.test.ts` - Instruction handling
- `__tests__/PhasedInstaller.test.ts` - Integration tests for phase advancement
