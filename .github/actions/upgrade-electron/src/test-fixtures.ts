import { type ElectronRelease } from "./schemas";

// Test-only fixtures. Not imported by index.ts, so none of this reaches the bundle.

/** A trimmed pnpm-workspace.yaml with every entry the action edits. */
export const workspaceYaml = (
  options: { electron?: string; nodeAbi?: string; node?: string } = {},
): string => {
  const { electron = "45.0.0", nodeAbi = "4.35.0", node = "24.22.0" } = options;
  return [
    "packages:",
    "  - ./src/shared",
    "",
    "catalog:",
    `  electron: ${electron}`,
    "  electron-builder: 24.13.3",
    `  node-abi: ${nodeAbi}`,
    "  nx: 23.0.1",
    "",
    "minimumReleaseAge: 1440",
    "",
    "overrides:",
    `  node-abi: ${nodeAbi}`,
    "",
    "allowBuilds:",
    '  "@nexusmods/fomod-installer-native": true',
    "  core-js: true",
    "  loot@https://codeload.github.com/Nexus-Mods/node-loot/tar.gz/abc123: true",
    `  node@runtime:${node}: true`,
    "  nx: false",
    "  xxhash-addon: true",
    "",
  ].join("\n");
};

/** A trimmed package.json with the three Node.js pins. */
export const packageJson = (node = "24.22.0"): string =>
  [
    "{",
    '  "name": "@vortex/monorepo",',
    '  "engines": {',
    `    "node": "${node}",`,
    '    "runtime": {',
    '      "name": "node",',
    `      "version": "${node}",`,
    '      "onFail": "download"',
    "    }",
    "  },",
    '  "devEngines": {',
    '    "runtime": {',
    '      "name": "node",',
    `      "version": "${node}",`,
    '      "onFail": "download"',
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");

export const MINUTE = 60 * 1000;
export const DAY = 24 * 60 * MINUTE;

/** The fixed "current time" used across tests. */
export const NOW = Date.parse("2026-10-28T12:00:00.000Z");

/** An Electron release published `ageMs` before NOW. */
export const release = (version: string, node: string, ageMs = 2 * DAY): ElectronRelease => ({
  version,
  node,
  date: new Date(NOW - ageMs).toISOString().slice(0, 10),
  fullDate: new Date(NOW - ageMs).toISOString(),
});
