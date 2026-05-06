# NixOS Setup

NixOS `flake.nix` provides all deps out of box, matching repo Node/Electron.
It skips Volta/Corepack flow.

Validated on 13 April 2026. If any step is out of date, please open a [PR] or [issue].

## Requirements

- Nix with flakes enabled
- [direnv]
- [VS Code direnv extension]

Example `direnv` configuration:

```nix
{...}: {
  programs.direnv = {
    enable = true;
    enableBashIntegration = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
  };
}
```

## Setup

1. Clone the repository
2. Enable the dev shell:

```bash
direnv allow
```

From then on, the shell activates automatically when you enter the repo.

3. Use the shell-provided `pnpm`
4. Install dependencies:

```bash
pnpm install
```

5. Build the project:

```bash
pnpm run build:all
```

6. Start Vortex:

```bash
pnpm run start
```

## Debugging

- Start VS Code from a shell activated by `direnv`
- Use `Debug Electron (System Electron)`

## Extra Resources

- [Nix flake]
- [Nix packages search]
- [nix-direnv]

[direnv]: https://github.com/nix-community/nix-direnv
[Nix flake]: ../../flake.nix
[Nix packages search]: https://search.nixos.org/packages
[nix-direnv]: https://github.com/nix-community/nix-direnv
[VS Code direnv extension]: https://marketplace.visualstudio.com/items?itemName=mkhl.direnv
[PR]: https://github.com/Nexus-Mods/Vortex/compare
[issue]: https://github.com/Nexus-Mods/Vortex/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=
