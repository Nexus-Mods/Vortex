# Shared Setup

Use this page after you have installed the prerequisites from a distro-specific
guide or from [Generic Installation Instructions].

These steps cover the shared repository bootstrap flow for Windows and Linux.

## Setup

1. Install [Volta] via cmd/terminal.

Linux:

```bash
curl https://get.volta.sh | bash
```

Windows:

```powershell
winget install Volta.Volta
```

After installing Volta, restart terminal to update `$PATH`.
You can verify Volta is working by running `volta --version`.

2. Clone the repository through your git client or CLI with submodules, then open command prompt/terminal in that folder:

```bash
git clone --recurse-submodules https://github.com/Nexus-Mods/Vortex.git
cd Vortex
```
3. Install the pinned `node.js` and `yarn` versions:

```bash
volta install node@22 yarn@v1
```

4. Install `pnpm` through Corepack:

```bash
npm install --global corepack@latest
corepack install
```

5. Install Vortex dependencies:

```bash
pnpm install
```

## Verify Setup

```bash
git --version
volta --version
node --version
yarn --version
pnpm --version
python3 --version
dotnet --list-sdks
```

## Notes

- If `volta` is not available after terminal restart, add `~/.volta/bin` to your shell `PATH`
- You may want to pin Node locally with `volta pin node@22.22.0` to match the repo's `package.json`

[Generic Installation Instructions]: ./generic.md
[Volta]: https://docs.volta.sh/guide/getting-started
