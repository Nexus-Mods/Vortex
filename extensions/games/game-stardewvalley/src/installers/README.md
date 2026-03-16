# Stardew Valley installers

This folder contains installer modules for Stardew Valley mod package
detection and deployment.

- `archiveClassifier.ts`: shared archive-shape checks used by installer matchers.
- `rootFolderInstaller.ts`: installs files at the game root and is
  automatically used when a mod archive contains `Content/`.
- `stardewValleyInstaller.ts`: handles manifest-based Stardew Valley mods,
  including dependency-rule generation.
- `smapiInstaller.ts`: handles SMAPI package detection/extraction and SMAPI
  mod-type detection.

Each installer module exports both matcher functions (`test*`) and installer
functions so detection and install behaviour stay co-located.
