# Vortex Documentation

Project and coding documentation. To set up and build Vortex, start with
[CONTRIBUTING.md](../CONTRIBUTING.md). For code style, see
[CODESTYLE.md](../CODESTYLE.md). Agents should also read
[AGENTS.md](../AGENTS.md).

## Start here

- [writing-documentation.md](writing-documentation.md) - Conventions for adding to these docs

## Debugging

- [DEBUGGING-GUIDE.md](DEBUGGING-GUIDE.md) - VS Code debugging, log files, DevTools, Redux DevTools, performance
- [error-reporting/](error-reporting/README.md) - How errors are captured, filtered, fingerprinted and exported

## Writing code

- [design-system/page-migration.md](design-system/page-migration.md) - Converting a legacy `MainPage` to the new `Page` layout
- [I18N_MIGRATION_GUIDE.md](I18N_MIGRATION_GUIDE.md) - Namespaces, key format, using `t` correctly
- [I18N_STATUS.md](I18N_STATUS.md) - Migration progress by namespace
- [game-art-assets.md](game-art-assets.md) - Where game logos and tiles come from, and what extensions should provide

## Subsystems

- [mod-management/EXTERNAL-CHANGES.md](mod-management/EXTERNAL-CHANGES.md) - The External Changes dialog: change types, actions, auto-resolution
- [updater.md](updater.md) - How updates are detected, downloaded and applied
- [updater-testing.md](updater-testing.md) - Exercising the update cycle offline with the mock feed
- [updater-rehearsal.md](updater-rehearsal.md) - Signed end-to-end rehearsal against a real GitHub repo

## Building and shipping

- [packaging/windows.md](packaging/windows.md) - Local unsigned installers, the pipeline, signed CI builds
- [packaging/flatpak.md](packaging/flatpak.md) - Building and installing the Flatpak
- [flatpak/technical.md](flatpak/technical.md) - Flatpak manifest and runtime details
- [flatpak/maintenance.md](flatpak/maintenance.md) - Updating the Flatpak package
- [branching-and-release-strategy.md](branching-and-release-strategy.md) - Master, release branches, what lands where
- [cherry-pick-workflow.md](cherry-pick-workflow.md) - Automated cherry-picks between branches
- [publishing-releases.md](publishing-releases.md) - What happens when a release goes out

## Installing from source

- [install-instructions/](install-instructions/generic.md) - Per-distro prerequisites:
  [generic](install-instructions/generic.md) ·
  [Windows](install-instructions/windows.md) ·
  [Arch](install-instructions/archlinux.md) ·
  [Debian](install-instructions/debian-based.md) ·
  [Fedora](install-instructions/fedora.md) ·
  [NixOS](install-instructions/nixos.md) ·
  [shared setup](install-instructions/shared.md)

## Research

These describe other products, as prior art. They are not documentation of
Vortex itself.

- [investigation/vscode.md](investigation/vscode.md) - How VS Code's extension system works
- [investigation/obsidian.md](investigation/obsidian.md) - How Obsidian's plugin system works
