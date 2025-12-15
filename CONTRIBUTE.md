# Contributing

Recommended editor: [VS Code](https://code.visualstudio.com/) with workspace extensions (you'll be prompted to install them on first open).

## Generic Linux

### Requirements

- editor
- git
- [`volta`](https://volta.sh/)
    - `curl https://get.volta.sh | bash`

For [node-gyp](https://github.com/nodejs/node-gyp?tab=readme-ov-file#on-unix):

- A [supported 3.x version of Python](https://devguide.python.org/versions/)
- `make` and a C/C++ toolchain (`build-essentials` on Debian/Ubuntu)
- [.NET 9](https://dotnet.microsoft.com/en-us/download)

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

## Editor Setup

### VS Code

Install the recommended workspace extensions when prompted, or manually install:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - code linting
- [Prettier](https://marketplace.visualstudio.com/items?itemName=prettier.prettier-vscode) - code formatting

These are configured in `.vscode/extensions.json`.
