/**
 * Adaptor installer test CLI.
 *
 * Usage:
 *   npx tsx scripts/test-adaptor.ts <nexus-mods-url>
 *
 * Example:
 *   npx tsx scripts/test-adaptor.ts https://www.nexusmods.com/cyberpunk2077/mods/28795
 *
 * Flow: parse Nexus URL → resolve gameId via games.json → discover adaptor
 * whose info.nexusMods domain matches → call paths() → fetch mod's default
 * file list from Nexus GraphQL + S3 meta → call install() → render table.
 *
 * Environment:
 *   NEXUS_API_KEY — optional. Some Nexus endpoints (GraphQL modFiles)
 *     gate on an API key; set this if the script reports 401/403.
 *
 * Network: this CLI calls live Nexus services (games.json, GraphQL,
 * file-metadata S3) on every run. It has no offline fixture mode and
 * should not be wired into CI as-is.
 *
 * Prerequisites: `pnpm build` must have produced
 *   src/main/out/bootstrap.mjs
 *   packages/adaptors/<name>/dist/index.mjs
 * The CLI fails fast with a clear message if either is missing.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Table from "cli-table3";

import type {
  GameInfo,
  NexusModsEntry,
} from "../packages/adaptor-api/src/contracts/game-info.js";
import type { InstallMapping } from "../packages/adaptor-api/src/contracts/game-installer.js";
import type { StorePathSnapshot } from "../packages/adaptor-api/src/stores/providers.js";
import {
  Base,
  OS,
  Store,
} from "../packages/adaptor-api/src/stores/providers.js";
import { QualifiedPath } from "../packages/fs/src/browser/paths.js";
import type {
  IAdaptorHost,
  ILoadedAdaptor,
} from "../src/main/src/node-adaptor-host/loader.js";
import { createAdaptorHost } from "../src/main/src/node-adaptor-host/loader.js";

// ---------------------------------------------------------------------------
// Constants and paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const BOOTSTRAP_PATH = path.join(
  REPO_ROOT,
  "src",
  "main",
  "out",
  "bootstrap.mjs",
);
const ADAPTORS_DIR = path.join(REPO_ROOT, "packages", "adaptors");

const NEXUS_GAMES_URL = "https://data.nexusmods.com/file/nexus-data/games.json";
const NEXUS_GRAPHQL_URL = "https://api.nexusmods.com/v2/graphql";
const NEXUS_FILE_META_BASE =
  "https://file-metadata.nexusmods.com/file/nexus-files-s3-meta";

// ---------------------------------------------------------------------------
// External API types (mirror Nexus endpoints)
// ---------------------------------------------------------------------------

interface NexusGameEntry {
  id: number;
  domain_name: string;
  name: string;
}

interface NexusModFile {
  uid: string;
  uri: string;
  fileId: number;
  name: string;
  version: string;
  category: string;
  date: number;
}

interface PreviewDirectory {
  name: string;
  path: string;
  type: "directory";
  children: (PreviewDirectory | PreviewFile)[];
}

interface PreviewFile {
  name: string;
  path: string;
  type: "file";
  size: string;
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export function parseNexusUrl(input: string): {
  domain: string;
  modId: number;
} {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Not a valid URL: "${input}"`);
  }
  if (!url.hostname.endsWith("nexusmods.com")) {
    throw new Error(`Expected a nexusmods.com URL, got host "${url.hostname}"`);
  }
  const match = /^\/([^/]+)\/mods\/(\d+)/.exec(url.pathname);
  if (!match) {
    throw new Error(
      `URL path does not match /<domain>/mods/<id>: "${url.pathname}"`,
    );
  }
  return { domain: match[1]!, modId: Number(match[2]!) };
}

// ---------------------------------------------------------------------------
// Nexus API calls (Node built-in fetch, Node 22)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `${url} returned ${response.status}. Set NEXUS_API_KEY env var if this endpoint requires authentication.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `${url} returned ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

export async function fetchGames(): Promise<NexusGameEntry[]> {
  return fetchJson<NexusGameEntry[]>(NEXUS_GAMES_URL);
}

const MOD_FILES_QUERY = `query($modId: ID!, $gameId: ID!) {
  modFiles(modId: $modId, gameId: $gameId) {
    uid uri fileId name version category date
  }
}`;

export async function fetchModFiles(
  gameId: number,
  modId: number,
): Promise<NexusModFile[]> {
  const apiKey = process.env.NEXUS_API_KEY;
  const result = await fetchJson<{
    data?: { modFiles: NexusModFile[] };
    errors?: { message: string }[];
  }>(NEXUS_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { apikey: apiKey } : {}),
    },
    body: JSON.stringify({
      query: MOD_FILES_QUERY,
      variables: { modId: String(modId), gameId: String(gameId) },
    }),
  });
  if (result.errors?.length) {
    throw new Error(
      `GraphQL modFiles error: ${result.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!result.data?.modFiles) {
    throw new Error("GraphQL modFiles returned no data");
  }
  return result.data.modFiles;
}

export async function fetchArchiveManifest(
  gameId: number,
  modId: number,
  fileUri: string,
): Promise<PreviewDirectory> {
  const url = `${NEXUS_FILE_META_BASE}/${gameId}/${modId}/${encodeURIComponent(fileUri)}.json`;
  return fetchJson<PreviewDirectory>(url);
}

export function flattenManifest(dir: PreviewDirectory): string[] {
  const out: string[] = [];
  for (const child of dir.children) {
    if (child.type === "file") {
      out.push(child.path);
    } else {
      out.push(...flattenManifest(child));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Adaptor discovery + loading
// ---------------------------------------------------------------------------

interface AdaptorCandidate {
  name: string;
  bundlePath: string;
}

async function listAdaptorCandidates(): Promise<AdaptorCandidate[]> {
  const entries = await fs.readdir(ADAPTORS_DIR, { withFileTypes: true });
  const out: AdaptorCandidate[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const bundlePath = path.join(ADAPTORS_DIR, entry.name, "dist", "index.mjs");
    try {
      await fs.access(bundlePath);
    } catch {
      continue;
    }
    out.push({ name: entry.name, bundlePath });
  }
  return out;
}

/**
 * Loads each candidate adaptor, calls its /info service, and returns the
 * first one whose `nexusMods` list contains the requested domain. Adaptors
 * that don't match are shut down.
 */
async function discoverAdaptorForDomain(
  host: IAdaptorHost,
  domain: string,
): Promise<{ adaptor: ILoadedAdaptor; info: GameInfo }> {
  const candidates = await listAdaptorCandidates();
  if (candidates.length === 0) {
    throw new Error(
      `No built adaptors found under ${ADAPTORS_DIR}. Run \`pnpm build\` first.`,
    );
  }

  for (const candidate of candidates) {
    const loaded = await host.loadAdaptor({
      name: candidate.name,
      version: "1.0.0",
      bundlePath: candidate.bundlePath,
      requires: [],
    });
    const infoUri = loaded.manifest.provides.find((u) => u.endsWith("/info"));
    if (!infoUri) {
      await host.shutdown(loaded.pid);
      continue;
    }
    const info = (await loaded.call(infoUri, "getGameInfo", [])) as GameInfo;
    const match = info.nexusMods?.find(
      (entry: NexusModsEntry) => entry.domain === domain,
    );
    if (match) {
      return { adaptor: loaded, info };
    }
    await host.shutdown(loaded.pid);
  }

  throw new Error(`No adaptor found matching Nexus game domain: ${domain}`);
}

// ---------------------------------------------------------------------------
// Synthetic snapshot (portable — doesn't touch the filesystem)
// ---------------------------------------------------------------------------

export function buildSyntheticSnapshot(): StorePathSnapshot {
  const windowsBases = new Map<Base, QualifiedPath>([
    [Base.Game, QualifiedPath.parse("windows:///C/Games/TestGame")],
    [Base.Home, QualifiedPath.parse("windows:///C/Users/Test")],
    [
      Base.Temp,
      QualifiedPath.parse("windows:///C/Users/Test/AppData/Local/Temp"),
    ],
    [Base.AppData, QualifiedPath.parse("windows:///C/Users/Test/AppData")],
    [Base.Documents, QualifiedPath.parse("windows:///C/Users/Test/Documents")],
    [
      Base.MyGames,
      QualifiedPath.parse("windows:///C/Users/Test/Documents/My Games"),
    ],
  ]);
  return {
    store: Store.Steam,
    baseOS: OS.Windows,
    gameOS: OS.Windows,
    bases: new Map([[OS.Windows, windowsBases]]),
  };
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

function renderTable(
  mappings: readonly InstallMapping[],
  allFiles: readonly string[],
): void {
  const mappedSources = new Set<string>(mappings.map((m) => m.source));
  const unmapped = allFiles.filter((f) => !mappedSources.has(f));
  const perAnchor = new Map<string, number>();
  for (const m of mappings) {
    perAnchor.set(m.anchor, (perAnchor.get(m.anchor) ?? 0) + 1);
  }

  console.log(
    `Archive: ${allFiles.length} files, ${mappings.length} mapped, ${unmapped.length} unmapped`,
  );
  if (perAnchor.size > 0) {
    const breakdown = [...perAnchor.entries()]
      .map(([anchor, count]) => `${anchor}=${count}`)
      .join(", ");
    console.log(`By anchor: ${breakdown}`);
  }
  console.log();

  const table = new Table({
    head: ["Source", "Anchor", "Destination"],
    colWidths: [48, 14, 48],
    wordWrap: true,
    style: { head: [], border: [] },
  });
  for (const mapping of mappings) {
    table.push([mapping.source, mapping.anchor, mapping.destination]);
  }
  console.log(table.toString());

  if (unmapped.length > 0) {
    console.log();
    console.log(`Unmapped (${unmapped.length}):`);
    for (const file of unmapped) {
      console.log(`  ${file}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

async function ensureBootstrapExists(): Promise<void> {
  try {
    await fs.access(BOOTSTRAP_PATH);
  } catch {
    throw new Error(
      `Missing adaptor-host bootstrap at ${BOOTSTRAP_PATH}. Run \`pnpm build\` first.`,
    );
  }
}

export async function main(argv: string[]): Promise<void> {
  const input = argv[0];
  if (!input) {
    console.error("Usage: tsx scripts/test-adaptor.ts <nexus-mods-url>");
    process.exit(1);
  }

  const { domain, modId } = parseNexusUrl(input);
  await ensureBootstrapExists();

  const [games] = await Promise.all([fetchGames()]);
  const game = games.find((g) => g.domain_name === domain);
  if (!game) {
    throw new Error(`Unknown Nexus game domain: ${domain}`);
  }

  const host = createAdaptorHost({}, BOOTSTRAP_PATH);
  try {
    const { adaptor, info } = await discoverAdaptorForDomain(host, domain);

    const snapshot = buildSyntheticSnapshot();
    const pathsUri = adaptor.manifest.provides.find((u) =>
      u.endsWith("/paths"),
    );
    const installerUri = adaptor.manifest.provides.find((u) =>
      u.endsWith("/installer"),
    );
    if (!pathsUri) {
      throw new Error(
        `Adaptor ${adaptor.manifest.name} provides no /paths service`,
      );
    }
    if (!installerUri) {
      throw new Error(
        `Adaptor ${adaptor.manifest.name} provides no /installer service`,
      );
    }

    const paths = await adaptor.call(pathsUri, "paths", [snapshot]);

    const modFiles = await fetchModFiles(game.id, modId);
    if (modFiles.length === 0) {
      throw new Error(`Mod ${domain}/${modId} has no files`);
    }
    const mainFiles = modFiles
      .filter((f) => f.category === "MAIN")
      .sort((a, b) => b.date - a.date);
    const defaultFile =
      mainFiles[0] ?? modFiles.sort((a, b) => b.date - a.date)[0]!;

    const manifest = await fetchArchiveManifest(
      game.id,
      modId,
      defaultFile.uri,
    );
    const files = flattenManifest(manifest);

    const mappings = (await adaptor.call(installerUri, "install", [
      snapshot,
      paths,
      files,
    ])) as readonly InstallMapping[];

    console.log(`Mod:     ${defaultFile.name} (${domain} / ${modId})`);
    console.log(`Adaptor: ${adaptor.manifest.name} → ${info.gameUri}`);
    console.log(`File:    ${defaultFile.uri} (${defaultFile.category})`);
    console.log();
    renderTable(mappings, files);
  } finally {
    await host.shutdownAll();
  }
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
}
