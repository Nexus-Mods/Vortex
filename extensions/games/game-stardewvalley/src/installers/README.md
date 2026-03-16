# Stardew Valley installers

This folder contains installer modules for Stardew Valley mod package
detection and deployment.

## File map

- `archiveClassifier.ts`: shared archive-shape checks used by installer matchers.
- `rootFolderInstaller.ts`: installs files at the game root and is
  automatically used when a mod archive contains `Content/`.
- `stardewValleyInstaller.ts`: handles manifest-based Stardew Valley mods,
  including dependency-rule generation.
- `smapiInstaller.ts`: handles SMAPI package detection/extraction and SMAPI
  mod-type detection.

Each installer module exports both matcher functions (`test*`) and installer
functions so detection and install behaviour stay co-located.

## Which installer runs?

In plain English:

1. If archive contains `SMAPI.Installer.dll`, SMAPI installer handles it.
2. Else if archive has top-level `Content/`, root-folder installer handles it.
3. Else if archive has a valid `manifest.json`, standard Stardew installer handles it.

If none match, Vortex falls back to generic handling.

## Common contributor tasks

- Add support for new archive shape:
  - update `archiveClassifier.ts`,
  - then update the relevant installer module.
- Change dependency-rule behavior:
  - edit `stardewValleyInstaller.ts`.
- Change SMAPI package handling:
  - edit `smapiInstaller.ts`.
