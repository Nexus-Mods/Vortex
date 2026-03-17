# Contributing

## Requirements

This document will explain how to get started with Vortex development. First, make sure you have these general coding requirements:

- a [GitHub account](https://github.com/login) for creating pull requests,
- the `git` [CLI](https://git-scm.com/) or one [GUI client](https://git-scm.com/tools/guis) like [GitHub Desktop](https://github.com/apps/desktop),
- an editor with TypeScript support like [VSCode](https://code.visualstudio.com/download), [WebStorm](https://www.jetbrains.com/webstorm/) or [Neovim](https://neovim.io/).

Next, you need to install some build tools for Vortex:

- [Volta](https://docs.volta.sh/guide/getting-started) for Node version management,
- and the [.NET 9 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/9.0) for building .NET projects.

Vortex depends on native Node modules which require [node-gyp](https://github.com/nodejs/node-gyp). You need to install a [supported Python version](https://devguide.python.org/versions/) and a C/C++ toolchain:

- Windows: VS 2022 Build Tools, follow [node-gyp documentation](https://github.com/nodejs/node-gyp?tab=readme-ov-file#on-windows) for installation instructions
- Linux: make and GCC (package `build-essentails` on Debian/Ubuntu and `base-devel` on Arch Linux)

Starting with Python 3.12 you also need to install the `setuptools` packages. Verify your version by running `python3 --version` and install the package through `pip` or your system's package manager.

## Setup

1) Clone the repository
2) `volta install node@22`
3) `npm install --global corepack@latest`
4) `corepack install`
5) `pnpm run build:fomod`
6) `pnpm install`

## Developing

1) `pnpm run build:all`
2) `pnpm run start`

## Packaging

1) `pnpm run package:nosign`

## Further Reading

- [Debugging](./docs/DEBUGGING-GUIDE.md)
- [Flatpak](./docs/flatpak-maintenance.md)
- [Docker Dev Containers](./docker)
- [Nix](./flake.nix)

