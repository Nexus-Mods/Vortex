# Stardew Valley installers

This folder contains installer modules for Stardew Valley mod package
detection and deployment.

- `rootFolderInstaller.ts`: handles Content replacer archives deployed to the
  game root.
- `stardewValleyInstaller.ts`: handles manifest-based Stardew Valley mods,
  including dependency-rule generation.
- `smapiInstaller.ts`: handles SMAPI package detection/extraction and SMAPI
  mod-type detection.

Each installer module exports both matcher functions (`test*`) and installer
functions so detection and install behavior stay co-located.
