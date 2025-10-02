# Vortex Development Clean Command

This document explains how to use the enhanced `yarn clean` command with the optional `--dev-data` and `--full` flags.

## Usage

The standard `yarn clean` command works as before:

```bash
yarn clean
```

This will:
1. Install the `rm-local-modules` package
2. Run `rm-local-modules` to clean up local modules
3. Remove the `out` directory
4. Reinstall dependencies with `yarn install --check-files`

## Enhanced Usage

To also remove the Vortex development data directory (`~/Library/Application Support/vortex_devel`) on macOS, use the `--dev-data` flag:

```bash
yarn clean --dev-data
```

This will perform all the standard clean operations and additionally:
1. Remove the `~/Library/Application Support/vortex_devel` directory (macOS only)
2. Display appropriate messages on other platforms when the flag is used

### Full Clean

To perform a full clean (including development data on macOS and additional build artefacts), use the `--full` flag:

```bash
yarn clean --full
```

This will:
1. Perform all standard clean operations
2. Remove the `~/Library/Application Support/vortex_devel` directory on macOS
3. Remove additional build and cache artefacts tracked by the cleanup script

## Platform Support

- The `--dev-data` flag only removes the vortex_devel directory on macOS systems
- On other platforms, a message will be displayed indicating the flag is only supported on macOS
- The standard clean functionality works on all platforms
 - The `--full` flag extends `--dev-data` behavior on macOS and performs an exhaustive cleanup.

## Examples

```bash
# Standard clean (preserves vortex_devel directory)
yarn clean

# Clean including removal of vortex_devel directory (macOS only)
yarn clean --dev-data

# Full clean and reinstall, then rebuild manually if needed
yarn clean --full
```