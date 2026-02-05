# Contributing

Recommended editor: [VS Code](https://code.visualstudio.com/) with workspace extensions (you'll be prompted to install them on first open).

## Windows

### Requirements

- Windows 11
- Administrator privileges
- [winget](https://aka.ms/getwinget)
    - Should work out of the box.
    - If it doesn't it's called `App Installer` on Microsoft Store

### Setup

A bootstrap script is provided that installs all dependencies (Git, Python 3.10, CMake, VS 2022 Build Tools, NVM, Node.js, Yarn) and clones the repository to `C:\vortex\Vortex`.

1. Open PowerShell as Administrator (`Win + X`, then `A`)
2. Allow script execution (if needed):
    ```powershell
    Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
    ```
3. Run the bootstrap script:
    ```powershell
    .\windows_dev_setup.ps1
    ```
4. After completion:
    ```powershell
    cd C:\vortex\Vortex
    yarn install
    yarn build
    yarn start
    ```

The script is idempotent - it detects existing installations and only adds missing components.

## Generic Linux

### Requirements

- editor
- git
- [`volta`](https://volta.sh/) - manages Node.js and Yarn versions
    - `curl https://get.volta.sh | bash`
    - Versions are pinned in `package.json` under the `volta` key
    - Volta automatically uses the pinned versions when you enter the project directory

For [node-gyp](https://github.com/nodejs/node-gyp?tab=readme-ov-file#on-unix) and native module compilation, you'll need:

- A recent supported version of Python with `setuptools` (`distutils` was removed in 3.12+)
- A C/C++ toolchain
- [.NET 9 SDK](https://dotnet.microsoft.com/en-us/download) (verify with `dotnet --list-sdks`)

> **Note:** The install commands below should give you what you need. If a package is not found, search your distro's repository:
> [Ubuntu](https://launchpad.net/ubuntu/+search) | [Fedora](https://packages.fedoraproject.org/) | [Arch](https://archlinux.org/packages/)

#### Ubuntu

Refer to [.NET 9 install docs for Ubuntu](https://learn.microsoft.com/en-us/dotnet/core/install/linux-ubuntu-install).

```bash
# Build tools and Python
sudo apt install build-essential python3 python3-setuptools

# .NET 9 SDK (requires Microsoft's package repository)
source /etc/os-release
wget https://packages.microsoft.com/config/$ID/$VERSION_ID/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb
sudo apt update
sudo apt install dotnet-sdk-9.0
```

#### Debian

Refer to [.NET 9 install docs for Debian](https://learn.microsoft.com/en-us/dotnet/core/install/linux-debian).

```bash
# Build tools and Python
sudo apt install build-essential python3 python3-setuptools

# .NET 9 SDK (requires Microsoft's package repository)
source /etc/os-release
wget https://packages.microsoft.com/config/$ID/$VERSION_ID/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb
sudo apt update
sudo apt install dotnet-sdk-9.0
```

#### Fedora

```bash
sudo dnf groupinstall "Development Tools"
sudo dnf install python3 python3-setuptools dotnet-sdk-9.0
```

#### Arch Linux

```bash
sudo pacman -S base-devel python python-setuptools dotnet-sdk-9.0
```

### Setup

- Clone repository
- Install toolchain requirements: `volta install node yarn`
- Install dependencies: `yarn install`
- Build: `yarn build`
- Start: `yarn start`
    - Wayland: `yarn start --ozone-platform-hint=auto`

To get `nxm` protocol handler to work you need to run the script `./scripts/linux-protocol-registration.sh`. This script only needs to be run once.

### Notes

- In unlikely event you can't run `volta` after install; add it to `$PATH` manually
    - `export PATH="$HOME/.volta/bin:$PATH"` in `.zshrc`/`.bashrc` etc.
- You might want to pin node in volta e.g. `volta pin node@22.12.0`, to match what's in `package.json`.

## NixOS

There is a `flake.nix` that provides all required dependencies: `node`, `yarn`, `python`, `make`, `clang` toolchain, and Electron runtime libraries.

### Requirements

- Nix with flakes enabled
- (Recommended) [direnv](https://github.com/nix-community/nix-direnv) + [VSCode direnv extension](https://marketplace.visualstudio.com/items?itemName=mkhl.direnv)

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

### Setup

- Clone repository
- Enter development shell: `nix develop`
    - Or if using direnv: `direnv allow` (from now on shell will auto-activate when you `cd` into this folder)
- Install dependencies: `yarn install`
- Build: `yarn build`
- Start: `yarn start`

Python is included in the dev shell (with `setuptools`) for node-gyp and the Flatpak helper scripts.

**Debugging (Nix):** start VS Code from `nix develop` (or via direnv), then use `Debug Electron (System Electron)` to launch the system Electron from your Nix shell `PATH`.

## Flatpak Basics (Linux Packaging)

These dependencies are only required if you are building the Flatpak package.

### Requirements

- `flatpak`
- `flatpak-builder`
- `appstream` (for AppStream metadata validation - `appstreamcli`)

### Example installs (Linux)

- Ubuntu/Debian: `sudo apt install flatpak flatpak-builder appstream`
- Fedora: `sudo dnf install flatpak flatpak-builder appstream`
- Arch: `sudo pacman -S flatpak flatpak-builder appstream`
- NixOS: Included in `nix develop` (via `flake.nix`)

> [!note]
> There is an additional Python-based dependency `flatpak-node-generator`, but the scripts in `flatpak/scripts/` automatically install it for you. The Flathub remote is also added automatically if missing.

For the full Flatpak workflow, see `docs/flatpak-maintenance.md`.

## Editor Setup

### VS Code

Install the recommended workspace extensions when prompted, or manually install:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - code linting
- [Prettier](https://marketplace.visualstudio.com/items?itemName=prettier.prettier-vscode) - code formatting

These are configured in `.vscode/extensions.json`.
