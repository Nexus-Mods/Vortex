# Config Mod Feature (Plain-English Guide)

This folder contains the Stardew "config mod" feature.

If you are new to Vortex, this guide explains what that means and where to look.

## What problem this solves

Many Stardew mods create a `config.json` file only **after you run the game**.

Those generated files live in the game folder and can be lost when a mod is
updated, replaced, or removed.

To prevent data loss, this extension creates one Vortex-managed mod called:

- `Stardew Valley Configuration (<Profile Name>)`

That synthetic mod stores generated `config.json` files and re-deploys them when
needed.

## Quick recap (for new contributors)

- **Staging folder**: where Vortex stores mod files it controls.
- **Deploy**: Vortex links/copies files from staging into the game folder.
- **Purge**: Vortex removes deployed links/copies from the game folder.

The config-mod feature moves generated config files from the game folder into the
staging copy of the synthetic mod, then lets deploy put them back into the game.

## File map (what each file does)

- `index.ts`
    - Public entry points used by the rest of the extension.
    - Registers the "Sync Mod Configurations" toolbar action.
    - Exposes handlers for runtime events (`added-files`, `will-enable-mods`) and
      settings-driven revert behavior.

- `sync.ts`
    - Manual and automatic sync logic.
    - Scans the game mod install path for `config.json` files.
    - Imports eligible configs into the synthetic config mod.

- `ingest.ts`
    - Handles Vortex `added-files` events.
    - Routes new files into either:
        - config-mod import path (for `config.json`), or
        - normal file re-ingestion path (for all other files).

- `transitions.ts`
    - Handles Vortex `will-enable-mods` transitions.
    - When disabling/removing tracked mods, restores `config.json` back to the
      original mod before removing it from the synthetic config mod.

- `filesystem.ts`
    - Shared recursive directory walk/delete helpers for sync and transitions.
    - Keeps filesystem-specific behavior separate from feature orchestration.

- `lifecycle.ts`
    - Finds or creates the synthetic config mod.
    - Resolves where that mod lives on disk.
    - Stores and updates the list of mod ids tracked in synthetic-mod attributes.

- `policy.ts`
    - Safety checks and filtering rules.
    - Example: never import SMAPI internal files into the config mod.
    - Example: reject unsafe automatic ownership assumptions for root-style mods.

## Data written by this feature

- Settings toggle:
    - `settings.SDV.mergeConfigs[profileId]`
- Synthetic mod tracking attribute:
    - `persistent.mods.stardewvalley[configModId].attributes.configMod`
    - Value is an array of mod ids that currently own imported config files.

## Typical flow: manual sync button

1. User clicks "Sync Mod Configurations".
2. `sync.ts` scans for `config.json` files in active installed mods.
3. Files are copied into the synthetic config mod in staging.
4. Source files in the game folder are removed.
5. Deploy runs and links/copies managed files back into the game folder.

## Typical flow: disabling a mod

1. `transitions.ts` receives `will-enable-mods` with `enabled = false`.
2. If the mod id is tracked by the synthetic config mod, its `config.json` is
   copied back into the mod's own folder.
3. The synthetic mod tracking attribute is updated to remove that mod id.
