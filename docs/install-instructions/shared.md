# Shared Setup

Use this page after you have installed the prerequisites from a distro-specific
guide or from [Generic Installation Instructions].

These steps cover the shared repository bootstrap flow for Windows and Linux.

`pnpm` is the only tool you need to install by hand. The repository pins its own
`pnpm` and `node.js` versions and fetches them on install, so no version manager
is involved.

## Setup

1. Clone the repository through your git client or CLI with submodules, then open a terminal in that folder:

Linux:

```bash
git clone --recurse-submodules https://github.com/Nexus-Mods/Vortex.git
cd Vortex
```

Windows:

```powershell
git clone --recurse-submodules https://github.com/Nexus-Mods/Vortex.git C:\v
cd C:\v
```

Use `C:\v` on Windows to avoid path length issues.

2. Install [pnpm]. The installer is self-contained, so you do not need `node.js`
   or `npm` first:

Linux:

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

Windows:

```powershell
winget install -e --id pnpm.pnpm
```

Close and reopen your terminal so `pnpm` resolves from `PATH`, then verify with
`pnpm --version`.

If Windows Defender blocks the winget binary, use pnpm's own installer instead:

```powershell
Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression
```

3. Install Vortex dependencies:

```bash
pnpm install
```

The version you installed in step 2 only bootstraps the process. `pnpm` reads
`packageManager` from `package.json`, switches itself to that exact version, then
downloads the pinned `node.js` runtime declared in `devEngines.runtime`. Building
the native modules is the slow part of this step.

This also installs the git pre-commit hook for auto-formatting. If the hook is
missing, install it by hand:

```bash
pnpm run prepare
```

## Verify Setup

```bash
git --version
pnpm --version
pnpm exec node --version
pnpm nx --version
python3 --version
dotnet --list-sdks
```

`pnpm exec node --version` reports the repository's pinned `node.js` version,
which is not necessarily the one on your `PATH`.

## Notes

- Volta, Corepack, `npm` and a global `node.js` are not required. The `node.js`
  version is pinned by `devEngines.runtime` in `package.json` and by the `node`
  runtime entry in the `pnpm-workspace.yaml` catalog.
- `nx` is a dev dependency of the repository. Always run it as `pnpm nx <target>`;
  do not install it globally.
- If you want `node` and `npm` on `PATH` for unrelated projects, install `node.js`
  separately. It will not conflict, because repository scripts resolve `node` from
  `node_modules/.bin` first.
- Yarn 1 is only used by the Flatpak packaging flow. See [Flatpak maintenance].
- CI provisions `node.js` through Volta. That is a CI-only path and is not needed
  for local development.

[Generic Installation Instructions]: ./generic.md
[Flatpak maintenance]: ../flatpak/maintenance.md
[pnpm]: https://pnpm.io/installation
