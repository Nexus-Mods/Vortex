# External Changes Dialog — Architecture Deep Dive

## What it does

Vortex deploys mods by creating links (hardlinks/symlinks) from a **staging folder** (where mod files are stored) into the **game folder** (where the game reads them). It keeps a **deployment manifest** — a record of every file it deployed and what it linked to.

Before each new deployment, Vortex compares the current state of the game folder against that manifest. If something changed since the last deployment — a user edited a file, another tool deleted one, etc. — those are **external changes**. The dialog asks the user what to do about them.

## Trigger flow

1. **deploy.ts** calls `dealWithExternalChanges()` before deploying
2. **externalChanges.ts** — `checkForExternalChanges()` calls `activator.externalChanges()` on the deployment method (hardlink, symlink, etc.) for each mod type. The deployment method compares the game folder against its manifest and returns `IFileChange[]`
3. Changes are classified into three buckets:
    - **Merged file changes** (from `__merged` folder) — auto-resolved silently, never shown to user
    - **Collection/auto-resolve changes** — auto-resolved when a collection is being installed or `autoResolveAll` is set
    - **User changes** — everything else, shown in the dialog
4. The Redux action `showExternalChanges(userChanges)` is dispatched, which populates `state.session.mods.changes` and opens the dialog. It returns a Promise that resolves when the user clicks Confirm/Cancel

## The four change types

Every detected change has a `type` that describes _what happened_. Understanding these requires knowing the two locations involved:

- **Staging file** = the "source of truth" copy in Vortex's mod staging folder
- **Deployed file** = the link/copy in the game folder

| Type         | What happened                                                                                       | Meaning                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refchange`  | The deployed file in the game folder has different content than the staging file it was linked from | Something replaced or modified the file in the game folder (another tool, the game itself, manual edit). The link target changed or the file was overwritten.                                                    |
| `valchange`  | The file was modified in-place (both sides changed)                                                 | The actual bytes of the file differ, but through the same link. This happens with hardlinks when the file is edited in place rather than replaced. Both staging and deployed point to the same modified content. |
| `deleted`    | The deployed link in the game folder was deleted, but the staging file still exists                 | Something removed the file from the game folder (antivirus, another mod manager, manual deletion).                                                                                                               |
| `srcdeleted` | The staging file was deleted, but the deployed link still exists in the game folder                 | The source mod file in staging was removed (manual deletion, failed uninstall). The game folder still has a copy/link.                                                                                           |

## FileAction meanings per change type

Each change type has a set of valid actions. The key insight is that **"Save"** means _accept the external change as permanent_ and **"Revert"** means _undo the external change_:

### `refchange` — File content was replaced in the game folder

| Action   | Label                              | What it does                                                                                                                                                                               |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `drop`   | "Revert change (use staging file)" | Deletes the modified file from the game folder. Next deployment will re-link from the original staging file. The external edit is lost.                                                    |
| `import` | "Save change (use deployed file)"  | Copies the modified game-folder file back into staging, replacing the original. The external edit becomes the new source of truth.                                                         |
| `newest` | "Use newer file"                   | Compares `sourceModified` vs `destModified` timestamps. If staging is newer → `drop` (revert). If deployed is newer → `import` (save). This is the **default** for user-facing refchanges. |

### `valchange` — File modified in-place (through hardlink)

| Action | Label         | What it does                                                                                                                               |
| ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `nop`  | "Save change" | Does nothing. Since both sides share the same content (hardlink), the change is inherently saved. This is the only option and the default. |

Note: `valchange` is commented out in the dialog UI — it's never actually shown to the user.

### `deleted` — Deployed link was deleted from game folder

| Action    | Label                          | What it does                                                                                                                                                                       |
| --------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `restore` | "Revert change (restore file)" | Removes the file from the deployment manifest, so next deployment re-creates the link. The file reappears in the game folder.                                                      |
| `delete`  | "Save change (delete file)"    | Deletes the corresponding staging file permanently. The mod file is gone from both locations. **This is destructive** — triggers a confirmation dialog if >1 file. Default action. |

### `srcdeleted` — Staging file was deleted

| Action   | Label                          | What it does                                                                                 |
| -------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| `import` | "Revert change (restore file)" | Moves the deployed file from the game folder back into staging, restoring the source.        |
| `drop`   | "Save change (delete file)"    | Deletes the deployed file from the game folder. The file is gone everywhere. Default action. |

## Dialog UI grouping

The dialog (`ExternalChangeDialog.tsx`) splits changes into **up to three visible sections** (valchange is hidden):

1. **"File content modified"** — `refchange` entries
2. **"Source files were deleted"** — `srcdeleted` entries
3. **"Links were deleted"** — `deleted` entries

Each section shows a table with "Set all" links at the top for bulk actions.

There are **two view modes** toggled by "Show individual files":

- **By source (default)**: Groups files by their source mod name. Shows mod name, file count, and a single action for all files in that mod. Uses `ISourceEntry`.
- **By file**: Shows each `IFileEntry` individually with file path, staging modified time, deployed modified time, and per-file action.

## Auto-resolution rules

Not all changes reach the dialog. Two categories are resolved silently:

**Merged files** (`__merged` prefix) and **collection installs / autoResolveAll** use `defaultInternalAction`:

- `refchange` → `drop` (always re-deploy from staging)
- `valchange` → `nop`
- `deleted` → `restore` (always re-create the link)
- `srcdeleted` → `drop`

These defaults prioritize staging as the source of truth — appropriate for automated operations where external edits should not be preserved.

## State flow summary

```
activator.externalChanges()  →  IFileChange[]
        ↓
changeToEntry() / defaultAction()  →  IFileEntry[] with default actions
        ↓
dispatch(showExternalChanges())  →  populates Redux state, opens dialog
        ↓
User edits actions in dialog  →  dispatch(setExternalChangeAction())
        ↓
User clicks Confirm  →  dispatch(confirmExternalChanges())  →  resolves Promise
        ↓
applyFileActions()  →  performs file operations, returns updated manifest
```

## Key files

- `views/ExternalChangeDialog.tsx` — Main UI component
- `types/IFileEntry.ts` — Type definitions (`FileAction`, `IFileEntry`)
- `util/externalChanges.ts` — Business logic (detection, action application)
- `actions/session.ts` — Redux actions (`showExternalChanges`, `confirmExternalChanges`, `setExternalChangeAction`)
- `reducers/session.ts` — Redux reducer for `state.session.mods.changes`
- `types/IDeploymentMethod.ts` — `IFileChange` interface
