# Contributing

Recommended editor: [VS Code] with workspace extensions.
You will be prompted to install them when you first open the repo.

## Requirements

Before you start, make sure you have:

- A [GitHub account] for creating pull requests,
- The `git` [CLI] or a [GUI client] such as [GitHub Desktop],
- An editor with TypeScript support such as [VS Code download], [WebStorm] or [Neovim].

## Setup

1. Install distro-specific prerequisites:
    - [Windows setup]
    - Linux:
        - [Arch-based setup] (Arch, CachyOS, Manjaro)
        - [Debian-based setup] (Debian, Ubuntu, Pop!\_OS, Linux Mint)
        - [Fedora setup]
        - [NixOS setup]
    - If your distribution is not listed, try [Generic Installation Instructions].

2. Continue with [Shared Setup].

## Developing

After you have finished the setup steps:

1. `pnpm run build:all`
2. `pnpm run start`

## Debugging

### VS Code

- **F5** debugs both main and renderer processes
- **Build first** by running `pnpm run build:all` before debugging

See [docs/DEBUGGING-GUIDE.md] for detailed debugging
instructions.

## Packaging

- [Windows packaging]
- [Flatpak packaging]

## FAQ

### When will my changes be added to the stable release?

See [docs/branching-and-release-strategy.md] for more
information.

## Further Reading

- [Debugging]
- [Docker Dev Containers]

[Arch-based setup]: ./docs/install-instructions/archlinux.md
[CLI]: https://git-scm.com/
[Debian-based setup]: ./docs/install-instructions/debian-based.md
[Debugging]: ./docs/DEBUGGING-GUIDE.md
[Docker Dev Containers]: ./docker
[docs/DEBUGGING-GUIDE.md]: ./docs/DEBUGGING-GUIDE.md
[docs/branching-and-release-strategy.md]: ./docs/branching-and-release-strategy.md
[Fedora setup]: ./docs/install-instructions/fedora.md
[Flatpak packaging]: ./docs/packaging/flatpak.md
[GUI client]: https://git-scm.com/tools/guis
[Generic Installation Instructions]: ./docs/install-instructions/generic.md
[GitHub account]: https://github.com/login
[GitHub Desktop]: https://github.com/apps/desktop
[Neovim]: https://neovim.io/
[NixOS setup]: ./docs/install-instructions/nixos.md
[Shared Setup]: ./docs/install-instructions/shared.md
[VS Code]: https://code.visualstudio.com/
[VS Code download]: https://code.visualstudio.com/download
[WebStorm]: https://www.jetbrains.com/webstorm/
[Windows setup]: ./docs/install-instructions/windows.md
[Windows packaging]: ./docs/packaging/windows.md
