import { packageJsonNodePinsSchema } from "./schemas";

/** What the repository currently pins. */
export interface Pins {
  /** `electron` catalog entry in pnpm-workspace.yaml. */
  electron: string;
  /** Node.js version pinned in package.json (all three fields agree). */
  node: string;
  /** `node-abi` catalog entry in pnpm-workspace.yaml. */
  nodeAbi: string;
  /** `minimumReleaseAge` from pnpm-workspace.yaml, in milliseconds. */
  minReleaseAgeMs: number;
}

const ELECTRON_ENTRY = /^ {2}electron: (\d+\.\d+\.\d+)$/mu;
const NODE_ABI_ENTRY = /^ {2}node-abi: (\d+\.\d+\.\d+)$/mu;
const MINIMUM_RELEASE_AGE = /^minimumReleaseAge: (\d+)$/mu;

const matchOne = (text: string, pattern: RegExp, what: string): string => {
  const value = pattern.exec(text)?.[1];
  if (value === undefined) {
    throw new Error(`Could not find ${what} in pnpm-workspace.yaml`);
  }
  return value;
};

/**
 * Replaces every occurrence of `from` with `to`, requiring exactly `expected`
 * of them so a stray match or a drifted file fails loudly instead of silently.
 */
const replaceExactly = (
  text: string,
  from: string,
  to: string,
  expected: number,
  what: string,
): string => {
  const parts = text.split(from);
  const found = parts.length - 1;
  if (found !== expected) {
    throw new Error(`Expected ${expected} occurrence(s) of ${what}, found ${found}`);
  }
  return parts.join(to);
};

/** Reads the pinned versions, failing if the three package.json Node.js pins disagree. */
export const readPins = (workspaceText: string, packageJsonText: string): Pins => {
  const pkg = packageJsonNodePinsSchema.parse(JSON.parse(packageJsonText));
  const pins: Record<string, string> = {
    "engines.node": pkg.engines.node,
    "engines.runtime.version": pkg.engines.runtime.version,
    "devEngines.runtime.version": pkg.devEngines.runtime.version,
  };
  const node = pkg.devEngines.runtime.version;
  for (const [field, value] of Object.entries(pins)) {
    if (value !== node) {
      throw new Error(`package.json ${field} is ${value}, expected ${node}`);
    }
  }

  return {
    electron: matchOne(workspaceText, ELECTRON_ENTRY, "the electron catalog entry"),
    node,
    nodeAbi: matchOne(workspaceText, NODE_ABI_ENTRY, "the node-abi catalog entry"),
    minReleaseAgeMs:
      Number(matchOne(workspaceText, MINIMUM_RELEASE_AGE, "minimumReleaseAge")) * 60 * 1000,
  };
};

/** Rewrites the `electron` catalog entry. */
export const setElectron = (workspaceText: string, from: string, to: string): string =>
  replaceExactly(
    workspaceText,
    `\n  electron: ${from}\n`,
    `\n  electron: ${to}\n`,
    1,
    "the electron catalog entry",
  );

/** Rewrites the node-abi catalog entry and its identical overrides entry. */
export const setNodeAbi = (workspaceText: string, from: string, to: string): string =>
  replaceExactly(
    workspaceText,
    `\n  node-abi: ${from}\n`,
    `\n  node-abi: ${to}\n`,
    2,
    "the node-abi catalog and overrides entries",
  );

/** Rewrites the three Node.js pins in package.json. */
export const setPackageJsonNode = (packageJsonText: string, from: string, to: string): string =>
  replaceExactly(
    packageJsonText,
    `"${from}"`,
    `"${to}"`,
    3,
    "the pinned Node.js version in package.json",
  );

/** The key of an allowBuilds line, or undefined for comments and blank lines. */
const allowBuildsKey = (line: string): string | undefined => {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    return undefined;
  }
  return trimmed.slice(0, trimmed.lastIndexOf(":")).replace(/^"|"$/gu, "");
};

/**
 * Swaps the `node@runtime:<version>` key in allowBuilds: removes the entry for
 * `from` if present and adds one for `to`, keeping the block alphabetical.
 */
export const setAllowBuildsNode = (workspaceText: string, from: string, to: string): string => {
  const lines = workspaceText.split("\n");
  const start = lines.indexOf("allowBuilds:");
  if (start < 0) {
    throw new Error("Could not find allowBuilds in pnpm-workspace.yaml");
  }
  let end = start + 1;
  while (end < lines.length && /^ {2}\S/u.test(lines[end] ?? "")) {
    end++;
  }

  const oldKey = `node@runtime:${from}`;
  const newKey = `node@runtime:${to}`;
  const block = lines.slice(start + 1, end).filter((line) => allowBuildsKey(line) !== oldKey);
  const at = block.findIndex((line) => {
    const key = allowBuildsKey(line);
    return key !== undefined && key > newKey;
  });
  block.splice(at < 0 ? block.length : at, 0, `  ${newKey}: true`);

  lines.splice(start + 1, end - start - 1, ...block);
  return lines.join("\n");
};
