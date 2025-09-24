# Vortex Development Clean Command

This document explains how to use the enhanced `yarn clean` command with the optional `--dev-data` flag.

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

## Platform Support

- The `--dev-data` flag only removes the vortex_devel directory on macOS systems
- On other platforms, a message will be displayed indicating the flag is only supported on macOS
- The standard clean functionality works on all platforms

## Examples

```bash
# Standard clean (preserves vortex_devel directory)
yarn clean

# Clean including removal of vortex_devel directory (macOS only)
yarn clean --dev-data
```