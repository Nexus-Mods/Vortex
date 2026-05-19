# Migration Guide

This guide covers the changes extension developers need to make when migrating from Vortex 1.16 to Vortex 2.0. The Vortex API surface is largely unchanged, so most extensions will not require source code modifications - the migration is primarily about build tooling and dependency management.

## Overview of Changes

| Area                              | 1.16                                 | 2.0                                                                                                                |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Bundler                           | webpack                              | webpack (still supported) or Rolldown                                                                              |
| Runtime dependencies              | Manually listed as `devDependencies` | Automatically installed via `vortex-api` peer dependencies (registry packages); git-based packages listed manually |
| Development Vortex plugins folder | `%APPDATA%/vortex_devel/plugins`     | `%APPDATA%/@vortex/main/plugins`                                                                                   |

## Choose Your Migration Path

Switching to pnpm is recommended but optional. Most of Vortex's runtime packages are declared as `peerDependencies` of `vortex-api` and are auto-installed by pnpm, npm 7+, and Yarn Berry. A small number of git-based packages must be added manually (see [Step 2](#step-2-update-dependencies)).

### Path A: Switch to pnpm (recommended)

Switching to pnpm aligns your tooling with Vortex's own build system. See [Step 1: Switch to pnpm](#step-1-switch-to-pnpm-path-a-only) below.

### Path B: Keep your current package manager

npm (7+) and Yarn Berry (v2+) also auto-install peer dependencies - just skip Step 1 and go to [Step 2: Update Dependencies](#step-2-update-dependencies).

> **Note:** Yarn Classic (v1) does **not** auto-install peer dependencies. If you stay on Yarn Classic, you'll need to **manually maintain** your `devDependencies` to match the versions Vortex ships at runtime. The correct versions can be found in Vortex's [`pnpm-workspace.yaml`](https://github.com/Nexus-Mods/Vortex/blob/master/pnpm-workspace.yaml) under the `catalog:` section.

---

## Step 1: Switch to pnpm (Path A only)

### 1a. Update `packageManager` field

In your `package.json`, replace:

```diff
- "packageManager": "yarn@1.22.19"
+ "packageManager": "pnpm@10.31.0"
```

### 1b. Generate `pnpm-lock.yaml`

pnpm can import your existing lockfile to preserve resolved versions, then you can remove the old one:

```bash
pnpm import        # generates pnpm-lock.yaml from yarn.lock (or package-lock.json)
rm yarn.lock       # remove the old lockfile
pnpm install       # verify everything resolves correctly
```

See [`pnpm import`](https://pnpm.io/cli/import) for details.

### 1c. Replace Yarn commands in build scripts

If you have custom build scripts (e.g., a `build.js`), update all Yarn commands:

| Yarn                       | pnpm                                 |
| -------------------------- | ------------------------------------ |
| `yarn install`             | `pnpm install`                       |
| `yarn add <pkg>`           | `pnpm add <pkg>`                     |
| `yarn remove <pkg>`        | `pnpm remove <pkg>`                  |
| `yarn run <script>`        | `pnpm run <script>`                  |
| `yarn pack --filename <f>` | `pnpm pack --pack-destination <dir>` |
| `npx <cmd>`                | `pnpm exec <cmd>`                    |

> **Note:** `pnpm pack` produces a filename based on the package scope and version (e.g., `scope-name-1.0.0.tgz`), not a user-specified filename. If your build scripts rely on a specific `.tgz` filename, you'll need to rename the output after packing.

### 1d. Allow package install scripts

pnpm blocks lifecycle scripts (e.g., `postinstall`) by default for security. During `pnpm install`, it will prompt you to approve packages that need to run install scripts. You can approve them interactively or use `pnpm approve-builds` to review and approve pending packages:

```bash
pnpm approve-builds
```

This saves the approved list to `pnpm-workspace.yaml` under `allowBuilds`:

```yaml
allowBuilds:
    my-native-addon: true
    # Add other packages that need install scripts
```

> **Tip:** You can also pre-configure `allowBuilds` manually before running `pnpm install` if you already know which packages need build scripts (typically native addons).

### 1e. Adapt `resolutions`

The Yarn `resolutions` field is not supported by pnpm. Resolutions that pinned Vortex-provided packages (e.g., `@types/react`, `@types/react-dom`) can be removed entirely - those versions are now enforced by `vortex-api` peer dependencies.

If your extension has its own resolutions for **non-Vortex packages**, migrate them to pnpm `overrides` in `package.json`:

```diff
- "resolutions": {
-   "node-gyp": "^10.0.0",
-   "@types/react": "16.14.66",
-   "@types/react-dom": "16.9.25",
-   "some-transitive-dep": "^2.0.0"
- },
+ "pnpm": {
+   "overrides": {
+     "some-transitive-dep": "^2.0.0"
+   }
+ },
```

> **Note:** Yarn `resolutions` and pnpm `overrides` have slightly different syntax for scoped overrides. See the [pnpm overrides documentation](https://pnpm.io/package_json#pnpmoverrides) for details.

## Step 2: Update Dependencies

Vortex 2.0 ships `vortex-api` with `peerDependencies` that declare most packages Vortex provides at runtime (React, Redux, Lodash, Bluebird, etc.) along with their type definitions. When you install `vortex-api` with pnpm, npm 7+, or Yarn Berry, these peer dependencies are installed automatically.

You can **remove most Vortex runtime packages** from your `devDependencies`.

> The following example shows a subset of Vortex packages - your extension may use more or fewer. The principle is the same: any package covered by `vortex-api` peer dependencies can be removed.

#### Example: Before (1.16)

```json
{
    "devDependencies": {
        "vortex-api": "git+https://github.com/Nexus-Mods/vortex-api.git",
        "@nexusmods/nexus-api": "git+https://github.com/Nexus-Mods/node-nexus-api.git",
        "@types/bluebird": "3.5.20",
        "@types/lodash": "^4.14.149",
        "@types/node": "^22.0.0",
        "@types/react": "16.14.66",
        "@types/react-redux": "^7.1.9",
        "bluebird": "^3.7.2",
        "i18next": "^19.0.1",
        "react": "^16.12.0",
        "react-bootstrap": "^0.33.0",
        "react-dom": "^16.12.0",
        "react-i18next": "^11.11.0",
        "react-redux": "^7.1.3",
        "redux": "^4.0.4",
        "redux-act": "^1.7.7",
        "webpack": "^5.94.0",
        "webpack-cli": "^5.1.4"
    }
}
```

#### Example: After (2.0)

```json
{
    "devDependencies": {
        "vortex-api": "git+https://github.com/Nexus-Mods/vortex-api.git",
        "@nexusmods/nexus-api": "git+https://github.com/Nexus-Mods/node-nexus-api#4192c0c9f34306c2167e258dd4fef773af406161",
        "typescript": "5.9.3"
    }
}
```

Only keep dependencies that are:

- **Your extension's own dependencies** (listed in `dependencies`, bundled into your output)
- **Build tools** you use directly (TypeScript, your bundler, ESLint, Prettier, etc.)
- **Git-based Vortex packages** your extension imports directly (see below)
- **Type packages not covered by** `vortex-api` (e.g., `@types/react-bootstrap` if your extension uses it and it's not in the peer dependency list)

### Git-based packages (manual)

Some Vortex runtime packages are hosted on GitHub and not published to npm. These cannot be included in `vortex-api`'s `peerDependencies`, so you must add them to your `devDependencies` manually if your extension imports them.

**Important:** The commit hashes below must match the version Vortex ships. When Vortex updates these packages, you must update the hashes in your `devDependencies` to match. The authoritative source is the `catalog:` section in Vortex's [`pnpm-workspace.yaml`](https://github.com/Nexus-Mods/Vortex/blob/master/pnpm-workspace.yaml).

The full list of git-based packages:

```json
{
    "@nexusmods/nexus-api": "git+https://github.com/Nexus-Mods/node-nexus-api#4192c0c9f34306c2167e258dd4fef773af406161",
    "bbcode-to-react": "git+https://github.com/TanninOne/bbcode-to-react#c67356006470e5066ea447e04a3968dca367339d",
    "crash-dump": "git+https://github.com/Nexus-Mods/node-crash-dump#7fc76dabdc9117a7f238d7bf5e5fb7841a374804",
    "diskusage": "git+https://github.com/TanninOne/node-diskusage#eb52fd176b2c311dd3ae5f0e68ff7488c08a179d",
    "drivelist": "git+https://github.com/TanninOne/drivelist#720d1890db11482ec05fc0f6aa176cfa6e6844dd",
    "electron-redux": "git+https://github.com/TanninOne/electron-redux#66bbd9d389579806e8c4ebd87bd513a668cc64a8",
    "exe-version": "git+https://github.com/Nexus-Mods/node-exe-version#eded60fc0a0f3c234e1d586d2eb9952401945406",
    "json-socket": "git+https://github.com/foi/node-json-socket#d56c8e2938fa4284c4001b815d9b6e4a92b5c07b",
    "modmeta-db": "git+https://github.com/Nexus-Mods/modmeta-db#daa8935b6e38e255ec192c908adfce35d47c0336",
    "native-errors": "git+https://github.com/Nexus-Mods/node-native-errors#51913db07e4c9b68a96ba7fcf741b32796758f18",
    "node-7z": "git+https://github.com/Nexus-Mods/node-7z#3d98d2ba40906f8afa9de52d2ceb6a44f7143198",
    "permissions": "git+https://github.com/Nexus-Mods/node-permissions#7c1b6f1d6437f2238be51316de823b0fbd63e4c0",
    "rimraf": "git+https://github.com/TanninOne/rimraf#7b8b70d4e8783cd233fca3283cf1f930af4e39c2",
    "simple-vdf": "git+https://github.com/Nexus-Mods/vdf-parser#df279ff89cb480597544d3029e12f90cb8c79464",
    "turbowalk": "git+https://github.com/Nexus-Mods/node-turbowalk#3502f6ffc3f9eb55fe1c9c097b4e4772edce0c0f",
    "vortex-parse-ini": "git+https://github.com/Nexus-Mods/vortex-parse-ini#2425af99d1cff2331ccf3aacfa892c314e99e18d",
    "vortexmt": "git+https://github.com/Nexus-Mods/node-vortexmt#5251ea012ce856742aeaf73a583073497aff773a",
    "wholocks": "git+https://github.com/Nexus-Mods/node-wholocks#28da3bcf312312e577d7c636799a59011998b4af",
    "winapi-bindings": "git+https://github.com/Nexus-Mods/node-winapi-bindings#faa92afe3320731e98abc15b3f5f19c60896d7c1"
}
```

You only need to add the ones your extension actually imports. For example, if your extension uses `@nexusmods/nexus-api` and `turbowalk`, add just those two.

## Step 3: Update Build Configuration

### Webpack (still works)

If your extension uses the `vortex-api`-provided webpack helper (`api/bin/webpack.js`), no changes are needed - it handles externals automatically.

If you use a custom webpack config, you can simplify your externals by reading from `vortex-api`:

```js
// webpack.config.js
const { peerDependencies } = require("vortex-api/package.json");
module.exports = {
    // ...
    externals: [...Object.keys(peerDependencies || {}), "electron", "vortex-api"].reduce(
        (acc, dep) => {
            acc[dep] = `commonjs ${dep}`;
            return acc;
        },
        {},
    ),
};
```

### Rolldown (optional migration)

Vortex 2.0 uses [Rolldown](https://rolldown.rs/) internally. You can optionally migrate your extension to Rolldown as well.

#### Install Rolldown

Add Rolldown and remove webpack-related packages you no longer need:

```bash
# If using pnpm:
pnpm add -D rolldown
pnpm remove webpack webpack-cli  # also remove any webpack plugins/loaders you were using,
                                 # e.g. ts-loader, copy-webpack-plugin, native-addon-loader,
                                 # webpack-node-externals
# If using yarn:
yarn add -D rolldown
yarn remove webpack webpack-cli  # same as above
```

#### Create `rolldown.config.mjs`

```js
import { defineConfig } from "rolldown";
import { builtinModules, createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { peerDependencies } = require("vortex-api/package.json");
function getExternals() {
    const builtins = builtinModules.filter((m) => !m.startsWith("_"));
    return [
        ...new Set([...builtins, ...Object.keys(peerDependencies || {}), "electron", "vortex-api"]),
    ];
}
export default defineConfig({
    input: "src/index.ts",
    output: {
        file: "dist/index.js",
        format: "cjs",
        sourcemap: true,
        exports: "auto",
    },
    external: getExternals(),
    platform: "node",
    resolve: {
        extensions: [".js", ".jsx", ".json", ".ts", ".tsx"],
        tsconfigFilename: "tsconfig.json",
    },
    plugins: [
        // Add custom plugins as needed (e.g., for native addons, asset copying)
    ],
});
```

#### Update your build command

```diff
- "build": "npx webpack --config webpack.config.js"
+ "build": "pnpm exec rolldown --config rolldown.config.mjs"
```

## Step 4: Collections Type Declarations

The `collections` extension is now part of the Vortex monorepo and its type declarations are not yet distributed via the `vortex-api` package. If your extension imports types from `collections` (e.g., `ICollection`, `IExtendedInterfaceProps`, `IExtensionFeature`), you have two options:

### Option A: Add local type declarations

Create a `typings.custom/collections/` directory with the type definitions your extension needs, and add a `paths` mapping in `tsconfig.json`:

```json
{
    "compilerOptions": {
        "paths": {
            "collections/*": ["./typings.custom/collections/*"]
        }
    }
}
```

### Option B: Wait for `vortex-api` to include them

These types will be included in a future `vortex-api` release. If your extension doesn't need them immediately, you can skip this step.

## Step 5: Replace `VORTEX_VERSION` Constant

The `VORTEX_VERSION` constant from `@vortex/shared` is no longer available to extensions. Read the version from Redux state instead:

```diff
- import { VORTEX_VERSION } from "@vortex/shared";
- const version = VORTEX_VERSION;
+ const state = context.api.getState();
+ const version = state.app.appVersion;
```

## Step 6: Update Dev Deployment Path (dev builds only)

> Most extension developers don't use a dev build of Vortex and can skip this step.

If your build scripts copy the extension to Vortex's dev plugins folder, update the path:

```diff
- const deployPath = "vortex_devel/plugins";
+ const deployPath = "@vortex/main/plugins";
```

The production path (`Vortex/plugins`) remains unchanged.

## Step 7: Update Main Page Priorities

If your extension registers custom main pages for load order or save game management, update their `priority` values to match Vortex 2.0's page ordering:

| Page type               | Priority |
| ----------------------- | -------- |
| Custom Load Order pages | `30`     |
| Custom Save pages       | `50`     |

Additionally, page names should use **sentence case** (e.g., "Load order") rather than Title Case (e.g., "Load Order").

```js
context.registerMainPage("sort-none", "Load order", MyLoadOrderPage, {
    priority: 30,
    id: "my-loadorder",
    group: "per-game",
    // ...
});

context.registerMainPage("savegame", "Save games", MySavegamePage, {
    priority: 50,
    id: "my-savegames",
    group: "per-game",
    // ...
});
```

## Quick Checklist

### All extensions

- [ ] Remove registry runtime packages from `devDependencies` (now provided by `vortex-api` peer dependencies)
- [ ] Add git-based packages your extension uses to `devDependencies` with correct commit hashes
- [ ] If using a custom webpack config, simplify externals to read from `vortex-api/package.json` (or optionally migrate to Rolldown)
- [ ] Add local `collections` type declarations if needed
- [ ] Replace `VORTEX_VERSION` imports with `state.app.appVersion`
- [ ] Update `priority` for custom Load Order pages to `30` and Save pages to `50`
- [ ] If using a dev build of Vortex, update dev deployment path from `vortex_devel/plugins` to `@vortex/main/plugins`
- [ ] If using ESLint, add `typings.custom/**` to ignores (if applicable)
- [ ] Verify your extension builds and loads correctly

### If switching to pnpm (Path A)

- [ ] Replace `yarn.lock` with `pnpm-lock.yaml`
- [ ] Update `packageManager` field in `package.json`
- [ ] Replace `yarn`/`npx` commands with `pnpm`/`pnpm exec` in build scripts
- [ ] Remove runtime packages from `devDependencies` (now provided by `vortex-api` peer dependencies)
- [ ] Adapt `resolutions` field from `package.json`
