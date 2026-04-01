import type {
  DiagnosticResult,
  InstallPlan,
  InternalGameArchiveEntry,
  InstallerMatch,
  InternalGameArchiveInspectionResult,
  InternalGameConflict,
  InternalGameInstallRequest,
  InternalGameInstruction,
  InternalGameLoadOrderEntry,
  InternalGameManifest,
  InternalGameRuntimeSnapshot,
  LoadOrderSnapshot,
  Serializable,
  ToolLaunchPlan,
} from "@vortex/shared/ipc";

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path/win32";

import { parseCyberpunkArchive } from "./archiveParser";
import {
  buildArchiveConflictDiagnostics,
  buildArchiveParserDiagnostics,
  type ICyberpunkArchiveParserFailure,
} from "./diagnostics";
import {
  collectDependencyDiagnostics,
  detectContentSignals,
  getContentSignalsAttributeKey,
  serializeContentSignals,
} from "./dependencies";
import { betterIpcMain } from "../../ipc";

const GAME_ID = "cyberpunk2077";
const STEAM_APP_ID = "1091500";
const GOG_APP_ID = "1423049311";
const EPIC_APP_ID = "Ginger";
const V2077_DIR = "V2077";
const LOAD_ORDER_DIR = `${V2077_DIR}\\Load Order`;
const MODLIST_RELATIVE_PATH = `${V2077_DIR}\\modlist.txt`;
const GAME_EXE_RELATIVE_PATH = "bin\\x64\\Cyberpunk2077.exe";
const RED_LAUNCHER_RELATIVE_PATH = "REDprelauncher.exe";
const RED_DEPLOY_RELATIVE_PATH = "tools\\redmod\\bin\\redMod.exe";
const REDMOD_METADATA_RELATIVE_PATH = "tools\\redmod\\metadata.json";
const REDMOD_MODS_DIR = "mods";
const REDMOD_GENERATED_DIR = "r6\\cache\\modded";
const REDMOD_TYPE = "V2077_REDmod";
const MOD_TYPE_ATTRIBUTE = "V2077_mod_attr_mod_type";
const REDMOD_INFO_ATTRIBUTE = "V2077_mod_attr_redmod_info";
const REDMOD_INFO_ARRAY_ATTRIBUTE = "V2077_mod_attr_redmod_info_array";
const ARCHIVE_INFO_ARRAY_ATTRIBUTE = "V2077_mod_attr_archive_info_array";
const CYBERPUNK_USAGE_INSTRUCTIONS = [
  "Archives load before REDmods and win over REDmods.",
  "Sort within each bucket only.",
  "Mods are installed exactly as authored. Archive-to-REDmod autoconversion is disabled.",
].join(" ");
const GENERIC_REQUIRED_BY = {
  modId: 0,
  modName: "Cyberpunk 2077 Setup",
  modUrl: "https://nexus-mods.github.io/NexusMods.App/users/games/Cyberpunk2077/",
};
const KNOWN_ROOT_DIRS = new Set([
  "archive",
  "bin",
  "engine",
  "mods",
  "r6",
  "red4ext",
  "tools",
]);
const CYBERPUNK_MANIFEST: InternalGameManifest = {
  id: GAME_ID,
  name: "Cyberpunk 2077",
  mergeMods: true,
  queryModPath: "",
  executable: GAME_EXE_RELATIVE_PATH,
  parameters: ["-modded"],
  requiredFiles: [GAME_EXE_RELATIVE_PATH],
  logo: "gameart.png",
  environment: {
    SteamAPPId: STEAM_APP_ID,
  },
  details: {
    steamAppId: STEAM_APP_ID,
    gogAppId: GOG_APP_ID,
    epicAppId: EPIC_APP_ID,
  },
  compatible: {
    symlinks: false,
  },
  supportedTools: [
    {
      id: "cyberpunk2077-game-modded",
      name: "Launch Game with REDmods Enabled",
      shortName: "cp2077.exe -modded",
      executable: GAME_EXE_RELATIVE_PATH,
      requiredFiles: [GAME_EXE_RELATIVE_PATH],
      parameters: ["-modded"],
      relative: true,
      logo: "gameicon.jpg",
    },
    {
      id: "cyberpunk2077-redlauncher",
      name: "REDLauncher",
      shortName: "REDLauncher",
      executable: RED_LAUNCHER_RELATIVE_PATH,
      requiredFiles: [RED_LAUNCHER_RELATIVE_PATH],
      parameters: ["-modded"],
      relative: true,
      logo: "REDLauncher.png",
    },
    {
      id: "cyberpunk2077-reddeploy",
      name: "REDmod Deploy Latest Load Order",
      shortName: "REDdeploy",
      executable: RED_DEPLOY_RELATIVE_PATH,
      requiredFiles: [RED_DEPLOY_RELATIVE_PATH],
      parameters: [],
      relative: true,
      shell: true,
      exclusive: true,
      logo: "REDdeploy.png",
    },
  ],
};

export function setupCyberpunkHandlers(): void {
  betterIpcMain.handle("games:cyberpunk:getManifest", () => CYBERPUNK_MANIFEST);
  betterIpcMain.handle("games:cyberpunk:discover", async () => null);
  betterIpcMain.handle("games:cyberpunk:runSetup", (_event, runtime) =>
    runSetup(runtime),
  );
  betterIpcMain.handle(
    "games:cyberpunk:classifyInstall",
    async (_event, request, runtime) => classifyInstall(request, runtime),
  );
  betterIpcMain.handle(
    "games:cyberpunk:buildInstallPlan",
    async (_event, request, runtime) => buildInstallPlan(request, runtime),
  );
  betterIpcMain.handle("games:cyberpunk:compileLoadOrder", (_event, runtime) =>
    compileLoadOrder(runtime),
  );
  betterIpcMain.handle(
    "games:cyberpunk:applyLoadOrder",
    (_event, runtime, loadOrder) => applyLoadOrder(runtime, loadOrder),
  );
  betterIpcMain.handle(
    "games:cyberpunk:inspectArchive",
    (_event, runtime, modId) => inspectArchive(runtime, modId),
  );
  betterIpcMain.handle("games:cyberpunk:scanConflicts", (_event, runtime) =>
    scanConflicts(runtime),
  );
  betterIpcMain.handle("games:cyberpunk:getDiagnostics", (_event, runtime) =>
    getDiagnostics(runtime),
  );
  betterIpcMain.handle(
    "games:cyberpunk:getToolLaunchPlan",
    (_event, toolId, runtime, executable, args) =>
      getToolLaunchPlan(toolId, runtime, executable, args),
  );
}

async function runSetup(
  runtime: InternalGameRuntimeSnapshot,
): Promise<DiagnosticResult[]> {
  const gamePath = runtime.discovery?.path;
  if (!gamePath) {
    return [infoDiagnostic("cyberpunk-missing-path", "Cyberpunk path not resolved", "Setup was requested before the game path was available.")];
  }

  await mkdir(path.join(gamePath, V2077_DIR), { recursive: true });
  await mkdir(path.join(gamePath, REDMOD_MODS_DIR), { recursive: true });
  await mkdir(path.join(gamePath, REDMOD_GENERATED_DIR), { recursive: true });
  await mkdir(path.join(gamePath, LOAD_ORDER_DIR), { recursive: true });

  const diagnostics = await getDiagnostics(runtime);
  diagnostics.push(
    infoDiagnostic(
      "cyberpunk-setup-complete",
      "Cyberpunk directories prepared",
      "V2077 metadata, REDmod cache, and load-order directories are ready.",
    ),
  );
  return diagnostics;
}

async function classifyInstall(
  request: InternalGameInstallRequest,
  runtime: InternalGameRuntimeSnapshot,
): Promise<InstallerMatch> {
  const plan = await buildInstallPlan(request, runtime);
  return {
    id: plan.installerId,
    supported: plan.instructions.some((inst) => inst.type !== "error"),
    requiredFiles: [],
    message: plan.warnings?.join(" "),
  };
}

async function buildInstallPlan(
  request: InternalGameInstallRequest,
  runtime: InternalGameRuntimeSnapshot,
): Promise<InstallPlan> {
  const normalized = unwrapGiftwrap(
    request.files.map((file) => normalizeToWindows(file.path)),
  );
  const kinds = detectKinds(normalized);
  const installerId = `cyberpunk2077-${kinds.length > 1 ? "mixed" : (kinds[0] ?? "fallback")}`;
  const instructions: InternalGameInstruction[] = [];
  const archiveInfos = normalized
    .filter((filePath) => filePath.toLowerCase().endsWith(".archive"))
    .map((filePath) => ({
      sourcePath: filePath,
      destination: resolveDestinationPath(filePath),
    }));
  const contentSignals = detectContentSignals(normalized);

  for (const filePath of normalized) {
    const destination = resolveDestinationPath(filePath);
    instructions.push({
      type: "copy",
      source: filePath,
      destination,
    });
  }

  const redmodInfos = await extractRedmodInfos(request, normalized);
  if (redmodInfos.length > 0) {
    instructions.push({
      type: "attribute",
      key: MOD_TYPE_ATTRIBUTE,
      value: { data: REDMOD_TYPE },
    });
    instructions.push({
      type: "attribute",
      key: REDMOD_INFO_ARRAY_ATTRIBUTE,
      value: { data: redmodInfos },
    });
    instructions.push({
      type: "setmodtype",
      value: "REDmod",
    });
  }
  if (archiveInfos.length > 0) {
    instructions.push({
      type: "attribute",
      key: ARCHIVE_INFO_ARRAY_ATTRIBUTE,
      value: { data: archiveInfos },
    });
  }
  instructions.push({
    type: "attribute",
    key: getContentSignalsAttributeKey(),
    value: { data: serializeContentSignals(contentSignals) },
  });

  const diagnostics = await buildInstallDiagnostics(runtime, normalized, kinds);
  return {
    installerId,
    instructions,
    warnings: kinds.length > 1 ? [`Detected multiple Cyberpunk content buckets: ${kinds.join(", ")}`] : undefined,
    diagnostics,
  };
}

async function compileLoadOrder(
  runtime: InternalGameRuntimeSnapshot,
): Promise<LoadOrderSnapshot> {
  const inferredEntries = inferLoadOrderEntries(runtime);
  const existing = (runtime.loadOrder ?? []).map(normalizeLoadOrderEntry);
  const merged = mergeLoadOrder(existing, inferredEntries);
  return {
    entries: merged,
    usageInstructions: CYBERPUNK_USAGE_INSTRUCTIONS,
  };
}

async function applyLoadOrder(
  runtime: InternalGameRuntimeSnapshot,
  loadOrder: LoadOrderSnapshot,
): Promise<DiagnosticResult[]> {
  const gamePath = runtime.discovery?.path;
  if (!gamePath) {
    return [infoDiagnostic("cyberpunk-load-order-missing-path", "Game path unavailable", "Load order was not written because the game path is not known.")];
  }

  const profileId = runtime.activeProfileId ?? "default";
  const filePath = path.join(gamePath, LOAD_ORDER_DIR, `V2077-load-order-${profileId}.json`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(loadOrder, null, 2), "utf8");

  const redmods = loadOrder.entries.filter((entry) => entry.data?.["bucket"] === "redmod");
  const modListPath = path.join(gamePath, MODLIST_RELATIVE_PATH);
  await mkdir(path.dirname(modListPath), { recursive: true });
  await writeFile(
    modListPath,
    redmods.filter((entry) => entry.enabled !== false).map((entry) => entry.name).join("\r\n"),
    "utf8",
  );

  return [];
}

async function inspectArchive(
  runtime: InternalGameRuntimeSnapshot,
  modId?: string,
): Promise<InternalGameArchiveInspectionResult> {
  const inspection = await inspectArchives(runtime, modId);
  const conflictIds = new Set(
    (await scanConflicts(runtime)).flatMap((conflict) => [
      conflict.winnerEntryId,
      ...conflict.loserEntryIds,
    ]),
  );
  const entries = inspection.entries.map((entry) => ({
    ...entry,
    conflictState: resolveConflictState(
      conflictIds.has(entry.id),
      entry.id === inspection.winners[entry.hash],
    ),
  }));

  return {
    generatedAt: new Date().toISOString(),
    entries,
  };
}

function resolveConflictState(
  hasConflict: boolean,
  isWinner: boolean,
): InternalGameArchiveEntry["conflictState"] {
  if (!hasConflict) {
    return "none";
  }

  return isWinner ? "winner" : "loser";
}

async function scanConflicts(
  runtime: InternalGameRuntimeSnapshot,
): Promise<InternalGameConflict[]> {
  const inspection = await inspectArchives(runtime);
  return buildConflictsFromInspection(inspection);
}

function buildConflictsFromInspection(inspection: {
  entries: InternalGameArchiveEntry[];
  order: Map<string, number>;
}): InternalGameConflict[] {
  const byHash = new Map<string, InternalGameArchiveEntry[]>();

  inspection.entries.forEach((entry) => {
    const current = byHash.get(entry.hash) ?? [];
    if (!current.some((existing) => existing.modId === entry.modId)) {
      current.push(entry);
    }
    byHash.set(entry.hash, current);
  });

  return [...byHash.entries()]
    .map(([hash, entries]) => ({
      hash,
      entries: [...entries].sort((lhs, rhs) =>
        inspection.order.get(lhs.id)! - inspection.order.get(rhs.id)!),
    }))
    .filter(({ entries }) => entries.length > 1)
    .map(({ hash, entries }) => {
      const winner = entries[0];
      const label = winner.mappedName ?? hash;
      return {
        hash,
        mappedName: winner.mappedName,
        virtualPath: label,
        winnerEntryId: winner.id,
        winnerModId: winner.modId,
        bucket: winner.bucket,
        loserEntryIds: entries.slice(1).map((entry) => entry.id),
        loserModIds: entries.slice(1).map((entry) => entry.modId ?? ""),
      };
    });
}

async function getDiagnostics(
  runtime: InternalGameRuntimeSnapshot,
): Promise<DiagnosticResult[]> {
  const diagnostics: DiagnosticResult[] = [];
  const gamePath = runtime.discovery?.path;

  if (!gamePath) {
    return diagnostics;
  }

  if (await hasMissingFiles(gamePath, [RED_LAUNCHER_RELATIVE_PATH, RED_DEPLOY_RELATIVE_PATH, REDMOD_METADATA_RELATIVE_PATH])) {
    diagnostics.push({
      id: "cyberpunk-redmod-missing",
      level: "warning",
      kind: "framework",
      title: "REDmod is not installed",
      message: "Install the REDmod DLC to enable REDmod deployment and REDLauncher integration.",
      actionLabel: "Open REDmod instructions",
      actionUrl: "https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-users/user-guide-troubleshooting",
      fixType: "open-url",
    });
  }

  diagnostics.push(
    ...collectDependencyDiagnostics(runtime, GENERIC_REQUIRED_BY, GAME_ID),
  );

  const inspection = await inspectArchives(runtime);
  diagnostics.push(
    ...buildArchiveConflictDiagnostics(buildConflictsFromInspection(inspection)),
    ...buildArchiveParserDiagnostics(inspection.parserFailures),
  );

  return diagnostics;
}

async function getToolLaunchPlan(
  toolId: string,
  runtime: InternalGameRuntimeSnapshot,
  executable: string,
  args: string[],
): Promise<ToolLaunchPlan> {
  const gamePath = runtime.discovery?.path;
  if (!gamePath) {
    return { handled: false, executable, args };
  }

  if (toolId !== "cyberpunk2077-reddeploy") {
    return { handled: false, executable, args };
  }

  const modList = path.join(gamePath, MODLIST_RELATIVE_PATH);
  return {
    handled: false,
    executable,
    args: [...args, "deploy", `-modlist="${modList}"`],
    options: {
      cwd: gamePath,
      shell: true,
    },
  };
}

function normalizeToWindows(input: string): string {
  return input.replace(/\//g, "\\").replace(/^\\+/, "");
}

function unwrapGiftwrap(files: string[]): string[] {
  const topLevels = new Set(files.map((file) => file.split("\\")[0]).filter(Boolean));
  if (topLevels.size !== 1) {
    return files;
  }

  const [topLevel] = [...topLevels];
  if (topLevel == null || KNOWN_ROOT_DIRS.has(topLevel.toLowerCase())) {
    return files;
  }

  return files.map((file) => file.startsWith(`${topLevel}\\`) ? file.slice(topLevel.length + 1) : file);
}

function detectKinds(files: string[]): string[] {
  const kinds = new Set<string>();
  files.forEach((file) => {
    const lower = file.toLowerCase();
    if (lower.endsWith(".archive") || lower.startsWith("archive\\")) {
      kinds.add("archive");
    }
    if (lower.startsWith("mods\\") || lower.includes("\\mods\\")) {
      kinds.add("redmod");
    }
  });
  return [...kinds];
}

function resolveDestinationPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if ([...KNOWN_ROOT_DIRS].some((prefix) => lower.startsWith(`${prefix}\\`))) {
    return filePath;
  }
  if (lower.endsWith(".archive")) {
    return path.join("archive", "pc", "mod", path.basename(filePath));
  }
  return filePath;
}

async function extractRedmodInfos(
  request: InternalGameInstallRequest,
  files: string[],
): Promise<Array<{ name: string; version: string; relativePath: string; vortexModId: string }>> {
  const infoFiles = files.filter((file) => file.toLowerCase().endsWith("info.json") && file.toLowerCase().includes("mods\\"));
  const result: Array<{ name: string; version: string; relativePath: string; vortexModId: string }> = [];

  for (const infoPath of infoFiles) {
    try {
      const absolute = request.archivePath != null ? path.join(request.archivePath, infoPath) : undefined;
      const raw = absolute != null ? await readFile(absolute, "utf8") : "{}";
      const parsed = JSON.parse(raw) as { name?: string; version?: string };
      const relativePath = infoPath.split("\\").slice(0, -1).join("\\");
      result.push({
        name: parsed.name ?? path.basename(relativePath),
        version: parsed.version ?? "0.0.0",
        relativePath,
        vortexModId: "",
      });
    } catch {
      const relativePath = infoPath.split("\\").slice(0, -1).join("\\");
      result.push({
        name: path.basename(relativePath),
        version: "0.0.0",
        relativePath,
        vortexModId: "",
      });
    }
  }

  return result;
}

async function buildInstallDiagnostics(
  runtime: InternalGameRuntimeSnapshot,
  files: string[],
  kinds: string[],
): Promise<DiagnosticResult[]> {
  const diagnostics = await getDiagnostics(runtime);
  if (kinds.length > 1) {
    diagnostics.push(infoDiagnostic("cyberpunk-mixed-install", "Mixed install package detected", `This package contains multiple Cyberpunk content buckets: ${kinds.join(", ")}.`));
  }
  if (files.some((file) => file.toLowerCase().endsWith(".reds"))) {
    diagnostics.push({
      id: "cyberpunk-codeware-likely-required",
      level: "warning",
      kind: "missing-dependency",
      title: "Codeware may be required",
      message: "Detected .reds content in this package. Codeware may be required for the mod to function correctly.",
      fixType: "nexus-dependency",
      canonicalDependencyGameId: GAME_ID,
      canonicalDependencyModId: 7780,
      dependency: {
        gameId: GAME_ID,
        modId: 7780,
        modName: "Codeware",
      },
      requiredBy: {
        modId: 0,
        modName: "Cyberpunk package being installed",
      },
      requiredByModId: "installing-package",
    });
  }
  return diagnostics;
}

function inferLoadOrderEntries(
  runtime: InternalGameRuntimeSnapshot,
): InternalGameLoadOrderEntry[] {
  return (runtime.mods ?? []).map((mod) => {
    const redmodInfo = extractRedmodInfoFromAttributes(mod.attributes);
    const archiveInfo = extractArchiveInfoFromAttributes(mod.attributes);
    const bucket = redmodInfo.length > 0 || mod.attributes?.[MOD_TYPE_ATTRIBUTE] != null
      ? "redmod"
      : "archive";
    return normalizeLoadOrderEntry({
      id: mod.id,
      modId: mod.id,
      name: mod.name,
      enabled: mod.enabled ?? true,
      data: {
        bucket,
        sourcePath: archiveInfo[0]?.destination ?? redmodInfo[0]?.relativePath ?? mod.name,
        archiveInfo: archiveInfo as unknown as Serializable,
        redmodInfo: redmodInfo[0] as unknown as Serializable,
        redmodInfoArray: redmodInfo as unknown as Serializable,
      },
    });
  });
}

function extractRedmodInfoFromAttributes(
  attributes: Record<string, Serializable> | undefined,
): Array<{ name: string; version: string; relativePath: string; vortexModId: string }> {
  const arrayValue = attributes?.[REDMOD_INFO_ARRAY_ATTRIBUTE] as
    | { data?: Array<{ name?: string; version?: string; relativePath?: string; vortexModId?: string }> }
    | undefined;
  if (Array.isArray(arrayValue?.data)) {
    return arrayValue.data
      .filter((entry) => entry?.relativePath != null)
      .map((entry) => ({
        name: entry.name ?? "REDmod",
        version: entry.version ?? "0.0.0",
        relativePath: entry.relativePath ?? "",
        vortexModId: entry.vortexModId ?? "",
      }));
  }
  const singleValue = attributes?.[REDMOD_INFO_ATTRIBUTE] as
    | { data?: { name?: string; version?: string; relativePath?: string; vortexModId?: string } }
    | undefined;
  if (singleValue?.data?.relativePath) {
    return [{
      name: singleValue.data.name ?? "REDmod",
      version: singleValue.data.version ?? "0.0.0",
      relativePath: singleValue.data.relativePath,
      vortexModId: singleValue.data.vortexModId ?? "",
    }];
  }
  return [];
}

function extractArchiveInfoFromAttributes(
  attributes: Record<string, Serializable> | undefined,
): Array<{ sourcePath: string; destination: string }> {
  const arrayValue = attributes?.[ARCHIVE_INFO_ARRAY_ATTRIBUTE] as
    | { data?: Array<{ sourcePath?: string; destination?: string }> }
    | undefined;
  if (!Array.isArray(arrayValue?.data)) {
    return [];
  }
  return arrayValue.data
    .filter((entry) => entry?.destination != null)
    .map((entry) => ({
      sourcePath: entry.sourcePath ?? "",
      destination: entry.destination ?? "",
    }));
}

function extractArchiveInfoFromData(
  data: Record<string, Serializable> | undefined,
): Array<{ sourcePath: string; destination: string }> {
  const entries = data?.["archiveInfo"];
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter(
      (entry): entry is Record<string, Serializable> =>
        entry != null && typeof entry === "object" && !Array.isArray(entry),
    )
    .map((entry) => ({
      sourcePath: String(entry["sourcePath"] ?? ""),
      destination: String(entry["destination"] ?? ""),
    }))
    .filter((entry) => entry.destination.length > 0);
}

function extractRedmodInfoFromData(
  data: Record<string, Serializable> | undefined,
): Array<{ relativePath: string }> {
  const arrayValue = data?.["redmodInfoArray"];
  if (Array.isArray(arrayValue)) {
    return arrayValue
      .filter(
        (entry): entry is Record<string, Serializable> =>
          entry != null && typeof entry === "object" && !Array.isArray(entry),
      )
      .map((entry) => ({
        relativePath: String(entry["relativePath"] ?? ""),
      }))
      .filter((entry) => entry.relativePath.length > 0);
  }

  const singleValue = data?.["redmodInfo"];
  if (singleValue != null && typeof singleValue === "object" && !Array.isArray(singleValue)) {
    const relativePath = String((singleValue as Record<string, Serializable>)["relativePath"] ?? "");
    return relativePath.length > 0 ? [{ relativePath }] : [];
  }

  return [];
}

function normalizeLoadOrderEntry(entry: InternalGameLoadOrderEntry): InternalGameLoadOrderEntry {
  const bucket = entry.data?.bucket === "redmod" ? "redmod" : "archive";
  return {
    ...entry,
    enabled: entry.enabled ?? true,
    data: {
      ...(entry.data ?? {}),
      bucket,
    } as Record<string, Serializable>,
  };
}

function mergeLoadOrder(
  existing: InternalGameLoadOrderEntry[],
  inferred: InternalGameLoadOrderEntry[],
): InternalGameLoadOrderEntry[] {
  const byId = new Map(inferred.map((entry) => [entry.id, entry]));
  const result: InternalGameLoadOrderEntry[] = [];

  existing.forEach((entry) => {
    const next = byId.get(entry.id);
    if (next == null) {
      return;
    }
    result.push({
      ...next,
      enabled: entry.enabled ?? next.enabled,
      data: {
        ...(next.data ?? {}),
        ...(entry.data ?? {}),
      },
    });
    byId.delete(entry.id);
  });

  result.push(...byId.values());

  const archives = result.filter((entry) => entry.data?.["bucket"] !== "redmod");
  const redmods = result.filter((entry) => entry.data?.["bucket"] === "redmod");
  return [...archives, ...redmods];
}

async function hasMissingFiles(gamePath: string, requiredFiles: string[]): Promise<boolean> {
  const checks = await Promise.all(requiredFiles.map(async (relativePath) => {
    try {
      await access(path.join(gamePath, relativePath));
      return false;
    } catch {
      return true;
    }
  }));
  return checks.some(Boolean);
}

function infoDiagnostic(id: string, title: string, message: string): DiagnosticResult {
  return {
    id,
    level: "info",
    kind: "guidance",
    title,
    message,
    fixType: "none",
  };
}

async function inspectArchives(
  runtime: InternalGameRuntimeSnapshot,
  modId?: string,
): Promise<{
  entries: InternalGameArchiveEntry[];
  order: Map<string, number>;
  winners: Record<string, string>;
  parserFailures: ICyberpunkArchiveParserFailure[];
}> {
  const sources = await resolveArchiveSources(runtime, modId);
  const entries: InternalGameArchiveEntry[] = [];
  const order = new Map<string, number>();
  const winners: Record<string, string> = {};
  const parserFailures: ICyberpunkArchiveParserFailure[] = [];

  for (const source of sources) {
    let parsed;
    try {
      parsed = await parseCyberpunkArchive(source.absolutePath);
    } catch (err) {
      parserFailures.push({
        modId: source.modId,
        modName: source.modName,
        archivePath: source.absolutePath,
        relativePath: source.relativePath,
        message: err instanceof Error ? err.message : "Unknown archive parsing error",
      });
      continue;
    }

    parsed.forEach((item, idx) => {
      const id = `${source.modId ?? "external"}:${path.basename(source.absolutePath)}:${item.hash}:${idx}`;
      const virtualPath = item.mappedName ?? item.hash;
      if (winners[item.hash] == null) {
        winners[item.hash] = id;
      }
      order.set(id, source.order);
      entries.push({
        id,
        modId: source.modId,
        modName: source.modName,
        archivePath: source.absolutePath,
        sourcePath: source.relativePath,
        virtualPath,
        hash: item.hash,
        mappedName: item.mappedName,
        bucket: source.bucket,
        extension: path.extname(item.mappedName ?? source.absolutePath),
        size: undefined,
      });
    });
  }

  return { entries, order, winners, parserFailures };
}

async function resolveArchiveSources(
  runtime: InternalGameRuntimeSnapshot,
  modId?: string,
): Promise<Array<{
  modId?: string;
  modName?: string;
  bucket: "archive" | "redmod";
  absolutePath: string;
  relativePath: string;
  order: number;
}>> {
  const gamePath = runtime.discovery?.path;
  if (gamePath == null) {
    return [];
  }

  const loadOrder = mergeLoadOrder(
    (runtime.loadOrder ?? []).map(normalizeLoadOrderEntry),
    inferLoadOrderEntries(runtime),
  );
  const results: Array<{
    modId?: string;
    modName?: string;
    bucket: "archive" | "redmod";
    absolutePath: string;
    relativePath: string;
    order: number;
  }> = [];

  for (let idx = 0; idx < loadOrder.length; idx += 1) {
    const entry = loadOrder[idx];
    if (modId != null && entry.modId !== modId) {
      continue;
    }
    const bucket = (entry.data?.["bucket"] as "archive" | "redmod") ?? "archive";
    if (bucket === "archive") {
      const archiveInfo = extractArchiveInfoFromData(entry.data);
      for (const archive of archiveInfo) {
        if (archive.destination == null) {
          continue;
        }
        const absolutePath = path.join(gamePath, archive.destination);
        try {
          await access(absolutePath);
          results.push({
            modId: entry.modId,
            modName: entry.name,
            bucket,
            absolutePath,
            relativePath: archive.destination,
            order: idx,
          });
        } catch {
          continue;
        }
      }
    } else {
      const redmodInfos = extractRedmodInfoFromData(entry.data);
      for (const redmodInfo of redmodInfos) {
        const basePath = path.join(gamePath, redmodInfo.relativePath ?? "");
        const archiveFiles = await listArchiveFiles(basePath);
        archiveFiles.forEach((absolutePath) => {
          results.push({
            modId: entry.modId,
            modName: entry.name,
            bucket,
            absolutePath,
            relativePath: path.relative(gamePath, absolutePath),
            order: idx,
          });
        });
      }
    }
  }

  return results;
}

async function listArchiveFiles(basePath: string): Promise<string[]> {
  try {
    const entries = await readdir(basePath, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(basePath, entry.name);
        if (entry.isDirectory()) {
          return listArchiveFiles(absolutePath);
        }
        return entry.name.toLowerCase().endsWith(".archive") ? [absolutePath] : [];
      }),
    );
    return nested.flat();
  } catch {
    return [];
  }
}
