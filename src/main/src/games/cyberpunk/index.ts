import type {
  DiagnosticResult,
  InstallPlan,
  InstallerMatch,
  InternalGameDiscoveryResult,
  InternalGameInstallRequest,
  InternalGameInstruction,
  InternalGameLoadOrderEntry,
  InternalGameManifest,
  InternalGameMod,
  InternalGameRuntimeSnapshot,
  LoadOrderSnapshot,
  ToolLaunchPlan,
} from "@vortex/shared/ipc";

import { readFileSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path/win32";
import { spawn } from "node:child_process";

import {
  CYBERPUNK_MANIFEST,
  CYBERPUNK_USAGE_INSTRUCTIONS,
  GAME_EXE_RELATIVE_PATH,
  GAME_ID,
  GOG_APP_ID,
  LOAD_ORDER_DIR,
  MODLIST_RELATIVE_PATH,
  RED_DEPLOY_RELATIVE_PATH,
  RED_LAUNCHER_RELATIVE_PATH,
  REDMOD_GENERATED_DIR,
  REDMOD_METADATA_RELATIVE_PATH,
  REDMOD_MODS_DIR,
  STEAM_APP_ID,
  EPIC_APP_ID,
  V2077_DIR,
} from "./data/manifest";
import {
  AMM_PREFIX,
  ARCHIVE_PREFIX,
  ASI_PREFIX,
  AUDIOWARE_PREFIX,
  CET_PREFIX,
  HERITAGE_ARCHIVE_PREFIX,
  PRESET_CYBERCAT_PREFIX,
  PRESET_UNLOCKER_PREFIX,
  RED4EXT_PLUGIN_PREFIX,
  RED4EXT_PREFIX,
  REDMOD_BASEDIR,
  REDSCRIPT_HINTS_PREFIX,
  REDSCRIPT_PREFIX,
  SPECIALIZED_RULES,
  TWEAK_XL_PREFIX,
} from "./data/installers";

interface InternalGameService {
  readonly id: string;
  getManifest(): InternalGameManifest;
  discover(): Promise<InternalGameDiscoveryResult | null>;
  runSetup(runtime: InternalGameRuntimeSnapshot): Promise<DiagnosticResult[]>;
  classifyInstall(
    request: InternalGameInstallRequest,
    runtime: InternalGameRuntimeSnapshot,
  ): Promise<InstallerMatch>;
  buildInstallPlan(
    request: InternalGameInstallRequest,
    runtime: InternalGameRuntimeSnapshot,
  ): Promise<InstallPlan>;
  compileLoadOrder(
    runtime: InternalGameRuntimeSnapshot,
  ): Promise<LoadOrderSnapshot>;
  applyLoadOrder(
    runtime: InternalGameRuntimeSnapshot,
    loadOrder: LoadOrderSnapshot,
  ): Promise<DiagnosticResult[]>;
  getToolLaunchPlan(
    toolId: string,
    runtime: InternalGameRuntimeSnapshot,
    executable: string,
    args: string[],
  ): Promise<ToolLaunchPlan>;
  getDiagnostics(runtime: InternalGameRuntimeSnapshot): Promise<DiagnosticResult[]>;
}

const KNOWN_TOPLEVEL_DIRS = new Set([
  "archive",
  "bin",
  "engine",
  "mods",
  "r6",
  "red4ext",
]);
const LOAD_ORDER_VERSION = "1.0.0";

const MOD_TYPE_ATTRIBUTE = "V2077_mod_attr_mod_type";
const REDMOD_INFO_ATTRIBUTE = "V2077_mod_attr_redmod_info";
const REDMOD_INFO_ARRAY_ATTRIBUTE = "V2077_mod_attr_redmod_info_array";
const REDMOD_TYPE = "V2077_REDmod";
const PROTECTED_PATH_PREFIXES = [
  "engine\\config",
  "r6\\config",
  "r6\\input",
];

type InstallKind =
  | "multitype"
  | "core-cet"
  | "core-redscript"
  | "core-red4ext"
  | "core-input-loader"
  | "core-mod-settings"
  | "core-tweakxl"
  | "core-audioware"
  | "core-archivexl"
  | "core-amm"
  | "core-cyberscript"
  | "core-cybercat"
  | "redmod"
  | "archive"
  | "asi"
  | "amm"
  | "preset"
  | "audioware"
  | "cet"
  | "red4ext"
  | "redscript"
  | "tweakxl"
  | "config-json"
  | "config-xml"
  | "config-ini"
  | "fallback";

interface RedmodInfoForVortex {
  name: string;
  version: string;
  relativePath: string;
  vortexModId: string;
}

export function createCyberpunkService(): InternalGameService {
  return {
    id: GAME_ID,
    getManifest: () => CYBERPUNK_MANIFEST,
    discover: async () => null,
    runSetup: (runtime) => prepareGame(runtime),
    classifyInstall: async (request, runtime) => {
      const plan = await buildPlan(request, runtime);
      return {
        id: plan.installerId,
        supported: plan.instructions.length > 0,
        requiredFiles: [],
        message: plan.warnings?.join(" "),
      };
    },
    buildInstallPlan: (request, runtime) => buildPlan(request, runtime),
    compileLoadOrder: (runtime) => buildLoadOrder(runtime),
    applyLoadOrder: (runtime, loadOrder) => writeLoadOrder(runtime, loadOrder),
    getToolLaunchPlan: (toolId, runtime, executable, args) =>
      buildToolLaunchPlan(toolId, runtime, executable, args),
    getDiagnostics: (runtime) => collectDiagnostics(runtime, false),
  };
}

async function prepareGame(
  runtime: InternalGameRuntimeSnapshot,
): Promise<DiagnosticResult[]> {
  const gamePath = runtime.discovery?.path;
  if (gamePath === undefined) {
    return [
      {
        id: "cyberpunk-missing-path",
        level: "warning",
        title: "Cyberpunk path not resolved",
        message: "Setup was requested before the game path was available.",
      },
    ];
  }

  await mkdir(path.join(gamePath, V2077_DIR), { recursive: true });
  await mkdir(path.join(gamePath, REDMOD_MODS_DIR), { recursive: true });
  await mkdir(path.join(gamePath, REDMOD_GENERATED_DIR), { recursive: true });
  await mkdir(path.join(gamePath, LOAD_ORDER_DIR), { recursive: true });

  return collectDiagnostics(runtime, true);
}

async function collectDiagnostics(
  runtime: InternalGameRuntimeSnapshot,
  includeSetupHints: boolean,
): Promise<DiagnosticResult[]> {
  const gamePath = runtime.discovery?.path;
  if (gamePath === undefined) {
    return [];
  }

  const diagnostics: DiagnosticResult[] = [];
  const requiredRedmodFiles = [
    RED_LAUNCHER_RELATIVE_PATH,
    RED_DEPLOY_RELATIVE_PATH,
    REDMOD_METADATA_RELATIVE_PATH,
  ];

  const redmodMissing = await hasMissingFiles(gamePath, requiredRedmodFiles);
  if (redmodMissing) {
    diagnostics.push({
      id: "cyberpunk-redmod-missing",
      level: includeSetupHints ? "warning" : "info",
      title: "REDmod is not installed",
      message:
        "Install the REDmod DLC to enable REDmod deployment and REDLauncher integration.",
      actionLabel: redmodActionLabel(runtime.discovery?.store),
      actionUrl: redmodActionUrl(runtime.discovery?.store),
    });
  }

  if (includeSetupHints) {
    diagnostics.push({
      id: "cyberpunk-setup-complete",
      level: "info",
      title: "Cyberpunk directories prepared",
      message: "V2077 metadata, REDmod cache, and load-order directories are ready.",
    });
  }

  return diagnostics;
}

async function buildPlan(
  request: InternalGameInstallRequest,
  runtime: InternalGameRuntimeSnapshot,
): Promise<InstallPlan> {
  const files = normalizeInstallFiles(request.files);
  const stagedFiles = maybeUnwrapGiftwrap(files);
  const kinds = detectInstallKinds(stagedFiles);
  const primaryKind = kinds.length > 1 ? "multitype" : kinds[0] ?? "fallback";

  const instructions = await buildInstructionsForKinds(
    primaryKind,
    kinds,
    stagedFiles,
    request,
    runtime,
  );
  const diagnostics = buildInstallDiagnostics(primaryKind, kinds, instructions, runtime);

  return {
    installerId: `cyberpunk2077-${primaryKind}`,
    instructions,
    diagnostics,
    warnings:
      primaryKind === "multitype"
        ? [`Detected multiple Cyberpunk mod types: ${kinds.join(", ")}`]
        : undefined,
  };
}

function normalizeInstallFiles(files: InternalGameInstallRequest["files"]) {
  return files
    .filter((file) => file.path.length > 0)
    .map((file) => ({
      ...file,
      path: normalizeRelative(file.path),
    }));
}

function maybeUnwrapGiftwrap(
  files: InternalGameInstallRequest["files"],
): InternalGameInstallRequest["files"] {
  const topLevels = new Set<string>(files.map((file) => file.path.split("\\")[0]));
  if (topLevels.size !== 1) {
    return files;
  }

  const [topLevel] = [...topLevels] as string[];
  if (KNOWN_TOPLEVEL_DIRS.has(topLevel.toLowerCase())) {
    return files;
  }

  const stripped = files.map((file) => ({
    ...file,
    path: normalizeRelative(file.path.slice(topLevel.length + 1)),
  }));
  const strippedTopLevels = new Set<string>(
    stripped.map((file) => file.path.split("\\")[0]),
  );
  const containsKnownDirs = [...strippedTopLevels].some((name) =>
    KNOWN_TOPLEVEL_DIRS.has(name.toLowerCase()),
  );
  const containsRedmodInfo = stripped.some((file) =>
    file.path.endsWith("info.json"),
  );

  return containsKnownDirs || containsRedmodInfo ? stripped : files;
}

function detectInstallKinds(
  files: InternalGameInstallRequest["files"],
): InstallKind[] {
  if (detectRedmod(files)) return ["redmod"];

  const normalizedPaths = files.map((file) => file.path);
  const matches = SPECIALIZED_RULES
    .filter((rule) => matchesRule(rule, normalizedPaths))
    .map((rule) => rule.id as InstallKind);

  if (matches.length > 0) {
    return dedupeKinds(matches);
  }

  if (files.some((file) => isArchiveLike(file.path))) return ["archive"];
  if (files.some((file) => hasConfigExtension(file.path))) return ["config-json"];
  return ["fallback"];
}

function matchesRule(rule: { requiredAll?: string[]; requiredAny?: string[]; pathPrefixes?: string[]; extensions?: string[] }, normalizedPaths: string[]): boolean {
  const hasRequiredAll =
    rule.requiredAll === undefined
      || rule.requiredAll.every((entry) =>
        normalizedPaths.includes(normalizeRelative(entry)),
      );
  const hasRequiredAny =
    rule.requiredAny === undefined
      || rule.requiredAny.some((entry) =>
        normalizedPaths.includes(normalizeRelative(entry)),
      );
  const hasPrefix =
    rule.pathPrefixes === undefined
      || normalizedPaths.some((file) =>
        rule.pathPrefixes!.some((prefix) =>
          startsWithPath(file, normalizeRelative(prefix)),
        ),
      );
  const hasExtension =
    rule.extensions === undefined
      || normalizedPaths.some((file) =>
        rule.extensions!.includes(path.extname(file).toLowerCase()),
      );

  return hasRequiredAll && hasRequiredAny && hasPrefix && hasExtension;
}

function dedupeKinds(kinds: InstallKind[]): InstallKind[] {
  return [...new Set(kinds)];
}

function detectRedmod(files: InternalGameInstallRequest["files"]): boolean {
  const normalizedPaths = files.map((file) => file.path);
  if (normalizedPaths.some((file) => startsWithPath(file, REDMOD_BASEDIR))) {
    return normalizedPaths.some((file) => file.endsWith("\\info.json"));
  }

  const hasRootInfo = normalizedPaths.includes("info.json");
  const hasRedmodSubdir = normalizedPaths.some((file) =>
    /^(archives|customSounds|scripts|tweaks)(\\|$)/i.test(file),
  );
  if (hasRootInfo && hasRedmodSubdir) {
    return true;
  }

  const rootInfoDirs = normalizedPaths
    .filter((file) => file.endsWith("\\info.json"))
    .map((file) => file.slice(0, -("\\info.json".length)));
  return rootInfoDirs.some((dir) =>
    normalizedPaths.some((file) =>
      startsWithPath(file, `${dir}\\archives`) ||
      startsWithPath(file, `${dir}\\customSounds`) ||
      startsWithPath(file, `${dir}\\scripts`) ||
      startsWithPath(file, `${dir}\\tweaks`),
    ),
  );
}

async function buildRedmodInstructions(
  files: InternalGameInstallRequest["files"],
  request: InternalGameInstallRequest,
  runtime: InternalGameRuntimeSnapshot,
): Promise<InternalGameInstruction[]> {
  const modInfos = await collectRedmodInfos(files, request);
  const primaryInfo = modInfos[0] ?? {
    name: deriveArchiveName(request.archivePath),
    version: "0.0.1",
    relativePath: `${REDMOD_BASEDIR}\\${deriveArchiveName(request.archivePath)}`,
    vortexModId: "",
  };

  const instructions = files
    .filter((file) => !file.isDirectory)
    .map<InternalGameInstruction>((file) => ({
      type: "copy",
      source: file.path,
      destination: toCanonicalRedmodDestination(file.path, primaryInfo.name),
    }));

  instructions.push(
    makeAttributeInstruction(MOD_TYPE_ATTRIBUTE, { data: REDMOD_TYPE }),
    makeAttributeInstruction(REDMOD_INFO_ATTRIBUTE, { data: primaryInfo }),
    makeAttributeInstruction(REDMOD_INFO_ARRAY_ATTRIBUTE, { data: modInfos.length > 0 ? modInfos : [primaryInfo] }),
  );

  if (runtime.features?.v2077_feature_redmod_autoconvert_archives) {
    instructions.push(
      makeAttributeInstruction("V2077_mod_attr_autoconverted", { data: true }),
    );
  }

  return instructions;
}

async function collectRedmodInfos(
  files: InternalGameInstallRequest["files"],
  request: InternalGameInstallRequest,
): Promise<RedmodInfoForVortex[]> {
  const infoFiles = files
    .filter((file) => file.path.endsWith("info.json"))
    .map((file) => file.path);

  const infos: RedmodInfoForVortex[] = [];
  for (const infoPath of infoFiles) {
    try {
      const content = await readFile(path.join(request.stagingPath, infoPath), "utf8");
      const parsed = JSON.parse(content) as { name?: string; version?: string };
      const relativePath = inferRedmodRelativePath(infoPath, parsed.name);
      infos.push({
        name: parsed.name ?? path.basename(relativePath),
        version: parsed.version ?? "0.0.1",
        relativePath,
        vortexModId: "",
      });
    } catch {
      infos.push({
        name: deriveArchiveName(request.archivePath),
        version: "0.0.1",
        relativePath: inferRedmodRelativePath(infoPath),
        vortexModId: "",
      });
    }
  }

  return infos;
}

function inferRedmodRelativePath(infoPath: string, fallbackName?: string): string {
  if (startsWithPath(infoPath, REDMOD_BASEDIR)) {
    const [, modName] = infoPath.split("\\");
    return `${REDMOD_BASEDIR}\\${modName}`;
  }

  const segments = infoPath.split("\\");
  if (segments.length > 1) {
    return `${REDMOD_BASEDIR}\\${segments[0]}`;
  }

  return `${REDMOD_BASEDIR}\\${fallbackName ?? "AutoconvertedMod"}`;
}

function toCanonicalRedmodDestination(filePath: string, modName: string): string {
  if (startsWithPath(filePath, REDMOD_BASEDIR)) {
    return filePath;
  }

  const rootInfoDir = filePath.includes("\\") ? filePath.split("\\")[0] : "";
  if (rootInfoDir !== "" && rootInfoDir !== "archives" && rootInfoDir !== "customSounds" && rootInfoDir !== "scripts" && rootInfoDir !== "tweaks" && rootInfoDir !== "info.json") {
    return `${REDMOD_BASEDIR}\\${filePath}`;
  }

  return `${REDMOD_BASEDIR}\\${modName}\\${filePath}`;
}

async function buildArchiveInstructions(
  files: InternalGameInstallRequest["files"],
  request: InternalGameInstallRequest,
  runtime: InternalGameRuntimeSnapshot,
): Promise<InternalGameInstruction[]> {
  const instructions: InternalGameInstruction[] = [];
  const archiveFiles = files.filter((file) => !file.isDirectory && isArchiveLike(file.path));
  const autoconvert = runtime.features?.v2077_feature_redmod_autoconvert_archives === true;
  const modName = deriveArchiveName(request.archivePath);

  const redmodInfos: RedmodInfoForVortex[] = [];
  for (const file of archiveFiles) {
    if (startsWithPath(file.path, HERITAGE_ARCHIVE_PREFIX) && autoconvert) {
      const relativePath = `${REDMOD_BASEDIR}\\${modName}`;
      const basename = path.basename(file.path);
      instructions.push({
        type: "copy",
        source: file.path,
        destination: `${relativePath}\\archives\\${basename}`,
      });
      redmodInfos.push({
        name: modName,
        version: "0.0.1",
        relativePath,
        vortexModId: "",
      });
      continue;
    }

    const destination =
      startsWithPath(file.path, ARCHIVE_PREFIX) || startsWithPath(file.path, HERITAGE_ARCHIVE_PREFIX)
        ? file.path
        : `${ARCHIVE_PREFIX}\\${path.basename(file.path)}`;

    instructions.push({
      type: "copy",
      source: file.path,
      destination,
    });
  }

  if (redmodInfos.length > 0) {
    instructions.push(
      makeAttributeInstruction(MOD_TYPE_ATTRIBUTE, { data: REDMOD_TYPE }),
      makeAttributeInstruction(REDMOD_INFO_ATTRIBUTE, { data: redmodInfos[0] }),
      makeAttributeInstruction(REDMOD_INFO_ARRAY_ATTRIBUTE, { data: redmodInfos }),
      makeAttributeInstruction("V2077_mod_attr_autoconverted", { data: true }),
    );
  }

  return instructions;
}

async function buildInstructionsForKinds(
  primaryKind: InstallKind,
  kinds: InstallKind[],
  files: InternalGameInstallRequest["files"],
  request: InternalGameInstallRequest,
  runtime: InternalGameRuntimeSnapshot,
): Promise<InternalGameInstruction[]> {
  if (primaryKind === "redmod") {
    return buildRedmodInstructions(files, request, runtime);
  }
  if (primaryKind === "archive") {
    return buildArchiveInstructions(files, request, runtime);
  }
  if (primaryKind === "multitype") {
    const instructions = await Promise.all(
      kinds.map((kind) => buildInstructionsForKinds(kind, [kind], files, request, runtime)),
    );
    return dedupeInstructions(instructions.flat());
  }
  return buildGenericInstructions(files, primaryKind, request);
}

function buildGenericInstructions(
  files: InternalGameInstallRequest["files"],
  kind: InstallKind,
  request: InternalGameInstallRequest,
): InternalGameInstruction[] {
  return files
    .filter((file) => !file.isDirectory)
    .map<InternalGameInstruction>((file) => ({
      type: "copy",
      source: file.path,
      destination: destinationForKind(kind, file.path, request),
    }));
}

function destinationForKind(
  kind: InstallKind,
  filePath: string,
  request: InternalGameInstallRequest,
): string {
  if (kind === "config-json") {
    const base = path.basename(filePath).toLowerCase();
    if (base === "giweights.json") return "engine\\config\\giweights.json";
    if (base === "bumpersSettings.json") return "r6\\config\\bumpersSettings.json";
    if (base === "options.json") {
      return startsWithPath(filePath, "r6\\config\\settings\\platform\\pc")
        ? "r6\\config\\settings\\platform\\pc\\options.json"
        : "r6\\config\\settings\\options.json";
    }
    return hasKnownTopLevel(filePath) ? filePath : `r6\\config\\${path.basename(filePath)}`;
  }

  if (kind === "config-xml") {
    if (startsWithPath(filePath, "r6\\config") || startsWithPath(filePath, "r6\\input")) {
      return filePath;
    }
    return `r6\\config\\${path.basename(filePath)}`;
  }

  if (kind === "config-ini") {
    if (startsWithPath(filePath, "engine\\config\\platform\\pc") || startsWithPath(filePath, "bin\\x64")) {
      return filePath;
    }
    return `engine\\config\\platform\\pc\\${path.basename(filePath)}`;
  }

  if (kind === "amm") {
    if (startsWithPath(filePath, AMM_PREFIX)) return filePath;
    if (startsWithPath(filePath, "Collabs") || startsWithPath(filePath, "User")) {
      return `${AMM_PREFIX}\\${filePath}`;
    }
  }

  if (kind === "preset") {
    return presetDestinationFor(filePath, request);
  }

  if (kind === "audioware") {
    return startsWithPath(filePath, AUDIOWARE_PREFIX)
      ? filePath
      : `${AUDIOWARE_PREFIX}\\${path.basename(filePath)}`;
  }

  if (kind === "asi") {
    return startsWithPath(filePath, ASI_PREFIX)
      ? filePath
      : `${ASI_PREFIX}\\${path.basename(filePath)}`;
  }

  return filePath;
}

function presetDestinationFor(
  filePath: string,
  request: InternalGameInstallRequest,
): string {
  if (startsWithPath(filePath, PRESET_UNLOCKER_PREFIX) || startsWithPath(filePath, PRESET_CYBERCAT_PREFIX)) {
    return filePath;
  }

  const absolute = path.join(request.stagingPath, filePath);
  const basename = path.basename(filePath);
  try {
    const content = readFileSync(absolute, "utf8");
    if (content.includes("\"DataExists\"") && content.includes("\"StringTriples\"")) {
      return `${PRESET_CYBERCAT_PREFIX}\\${basename}`;
    }
    if (content.includes("LocKey#")) {
      const genderDir =
        content.includes("14444638123505366956") ? "female" : "male";
      return `${PRESET_UNLOCKER_PREFIX}\\${genderDir}\\${basename}`;
    }
  } catch {
    // ignore and fall through
  }
  return `${PRESET_CYBERCAT_PREFIX}\\${basename}`;
}

function dedupeInstructions(
  instructions: InternalGameInstruction[],
): InternalGameInstruction[] {
  const seen = new Set<string>();
  return instructions.filter((instruction) => {
    const key = JSON.stringify(instruction);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildInstallDiagnostics(
  primaryKind: InstallKind,
  kinds: InstallKind[],
  instructions: InternalGameInstruction[],
  runtime: InternalGameRuntimeSnapshot,
): DiagnosticResult[] {
  const diagnostics: DiagnosticResult[] = [];

  if (primaryKind === "fallback") {
    diagnostics.push({
      id: "cyberpunk-install-fallback",
      level: "warning",
      title: "Fallback installer used",
      message:
        "This archive did not match a known Cyberpunk layout. Vortex will install it as-is into staging and you may need to adjust it manually before enabling it.",
    });
  }

  if (primaryKind === "multitype") {
    diagnostics.push({
      id: "cyberpunk-install-multitype",
      level: "info",
      title: "Multiple mod layouts detected",
      message: `This package matched multiple Cyberpunk layouts: ${kinds.join(", ")}.`,
    });
  }

  const protectedDestinations = collectProtectedDestinations(instructions);
  if (protectedDestinations.length > 0) {
    diagnostics.push({
      id: "cyberpunk-install-protected-paths",
      level: "warning",
      title: "Archive writes to protected config paths",
      message: `Review these paths before enabling the mod: ${protectedDestinations.join(", ")}`,
    });
  }

  if (hasAutoconvertedRedmod(instructions)) {
    diagnostics.push({
      id: "cyberpunk-install-autoconverted-redmod",
      level: "info",
      title: "Archive converted to REDmod layout",
      message:
        runtime.features?.v2077_feature_redmod_autoconvert_archives === true
          ? "Legacy archive content was converted into a REDmod-managed layout so it can participate in REDmod deployment and ordering."
          : "REDmod metadata was generated for archive content.",
    });
  }

  return diagnostics;
}

function collectProtectedDestinations(
  instructions: InternalGameInstruction[],
): string[] {
  return instructions
    .filter((instruction) => instruction.type === "copy" && instruction.destination !== undefined)
    .map((instruction) => instruction.destination!)
    .filter((destination) =>
      PROTECTED_PATH_PREFIXES.some((prefix) => startsWithPath(destination, prefix)),
    )
    .filter((destination, index, list) => list.indexOf(destination) === index);
}

function hasAutoconvertedRedmod(instructions: InternalGameInstruction[]): boolean {
  return instructions.some((instruction) =>
    instruction.type === "attribute"
      && instruction.key === "V2077_mod_attr_autoconverted"
      && (instruction.value as { data?: boolean } | undefined)?.data === true,
  );
}

async function buildLoadOrder(
  runtime: InternalGameRuntimeSnapshot,
): Promise<LoadOrderSnapshot> {
  const mods = runtime.mods ?? [];
  const orderIndex = new Map<string, number>(
    (runtime.loadOrder ?? []).map((entry, index) => [entry.id, index]),
  );

  const entries = mods
    .flatMap((mod) => toLoadOrderEntries(mod, runtime.activeProfileId ?? ""))
    .sort((left, right) => {
      const leftIndex = orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return left.name.localeCompare(right.name);
    });

  return {
    entries,
    usageInstructions: CYBERPUNK_USAGE_INSTRUCTIONS,
    persistedPath:
      runtime.discovery?.path && runtime.activeProfileId
        ? path.join(
            runtime.discovery.path,
            LOAD_ORDER_DIR,
            `V2077-load-order-${runtime.activeProfileId}.json`,
          )
        : undefined,
  };
}

function toLoadOrderEntries(
  mod: InternalGameMod,
  profileId: string,
): InternalGameLoadOrderEntry[] {
  const redmods = readRedmodInfos(mod);
  return redmods.map((info, index) => {
    const suffix = index === 0 ? "" : `-${index}`;
    return {
      id: `${mod.id}${suffix}`,
      name: `${info.name} ${info.version} (from ${mod.name})`,
      enabled: mod.enabled ?? false,
      data: {
        ownerVortexProfileId: profileId,
        vortexId: `${mod.id}${suffix}`,
        vortexModId: mod.modId ?? "",
        vortexModVersion: mod.version ?? "0.0.1+V2077",
        vortexEnabled: mod.enabled ?? false,
        redmodInfo: info,
      },
    };
  });
}

function readRedmodInfos(mod: InternalGameMod): RedmodInfoForVortex[] {
  const attrs = mod.attributes ?? {};
  const attrValue = attrs[REDMOD_INFO_ARRAY_ATTRIBUTE] as
    | { data?: RedmodInfoForVortex[] }
    | undefined;
  return attrValue?.data ?? [];
}

async function writeLoadOrder(
  runtime: InternalGameRuntimeSnapshot,
  loadOrder: LoadOrderSnapshot,
): Promise<DiagnosticResult[]> {
  const gamePath = runtime.discovery?.path;
  const profileId = runtime.activeProfileId;
  if (gamePath === undefined || profileId === undefined) {
    return [
      {
        id: "cyberpunk-load-order-missing-context",
        level: "warning",
        title: "Load order context missing",
        message: "Cannot write Cyberpunk load order without a game path and profile.",
      },
    ];
  }

  const filePath = path.join(gamePath, LOAD_ORDER_DIR, `V2077-load-order-${profileId}.json`);
  await mkdir(path.dirname(filePath), { recursive: true });

  const entries = loadOrder.entries.map((entry) => {
    const data = entry.data ?? {};
    const redmodInfo = (data.redmodInfo ?? {}) as RedmodInfoForVortex;
    return {
      vortexId: String(data.vortexId ?? entry.id),
      vortexModId: data.vortexModId ? String(data.vortexModId) : undefined,
      vortexModVersion: String(data.vortexModVersion ?? "0.0.1+V2077"),
      redmodName: redmodInfo.name,
      redmodVersion: redmodInfo.version,
      redmodPath: redmodInfo.relativePath,
      enabled: entry.enabled ?? false,
    };
  });

  const encoded = JSON.stringify(
    {
      loadOrderFormatVersion: LOAD_ORDER_VERSION,
      generatedAt: new Date().toISOString(),
      ownerVortexProfileId: profileId,
      entriesInOrderWithEarlierWinning: entries,
    },
    null,
    2,
  );

  await writeFile(filePath, encoded, "utf8");

  const modListEntries = entries
    .filter((entry) => entry.enabled)
    .map((entry) => path.basename(entry.redmodPath));
  const modListPath = path.join(gamePath, MODLIST_RELATIVE_PATH);
  await mkdir(path.dirname(modListPath), { recursive: true });
  await writeFile(modListPath, modListEntries.join("\r\n"), "utf8");

  const redDeployDiagnostics = await runRedmodDeploy(gamePath);
  return [
    {
      id: "cyberpunk-load-order-written",
      level: "info",
      title: "Cyberpunk load order updated",
      message: filePath,
    },
    ...redDeployDiagnostics,
  ];
}

async function runRedmodDeploy(gamePath: string): Promise<DiagnosticResult[]> {
  const exePath = path.join(gamePath, RED_DEPLOY_RELATIVE_PATH);
  const args = [
    "deploy",
    "-force",
    `-root="${gamePath}"`,
    `-rttiSchemaFile="${path.join(gamePath, REDMOD_METADATA_RELATIVE_PATH)}"`,
    `-modlist="${path.join(gamePath, MODLIST_RELATIVE_PATH)}"`,
  ];

  try {
    await access(exePath);
  } catch {
    return [
      {
        id: "cyberpunk-reddeploy-missing",
        level: "warning",
        title: "REDdeploy unavailable",
        message: "redMod.exe was not found. Install the REDmod DLC to deploy REDmods.",
      },
    ];
  }

  const result = await new Promise<DiagnosticResult[]>((resolve) => {
    const child = spawn(exePath, args, {
      cwd: path.dirname(exePath),
      shell: true,
      detached: false,
      windowsHide: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve([
          {
            id: "cyberpunk-reddeploy-complete",
            level: "info",
            title: "REDmod deployment complete",
            message: "redMod.exe finished successfully.",
          },
        ]);
        return;
      }

      resolve([
        {
          id: "cyberpunk-reddeploy-failed",
          level: "warning",
          title: "REDmod deployment failed",
          message: `redMod.exe exited with code ${code ?? -1}.`,
        },
      ]);
    });

    child.on("error", (error) =>
      resolve([
        {
          id: "cyberpunk-reddeploy-error",
          level: "warning",
          title: "REDmod deployment failed",
          message: error.message,
        },
      ]),
    );
  });

  return result;
}

async function buildToolLaunchPlan(
  toolId: string,
  runtime: InternalGameRuntimeSnapshot,
  executable: string,
  args: string[],
): Promise<ToolLaunchPlan> {
  const gamePath = runtime.discovery?.path;
  if (gamePath === undefined) {
    return { handled: false, executable, args };
  }

  if (toolId === "cyberpunk2077-reddeploy") {
    const compiled = await buildLoadOrder(runtime);
    await writeLoadOrder(runtime, compiled);
    return { handled: true };
  }

  if (toolId === "cyberpunk2077-game-modded") {
    return {
      handled: false,
      executable: path.join(gamePath, GAME_EXE_RELATIVE_PATH),
      args: ["-modded"],
      options: { shell: false, detach: true, expectSuccess: true },
    };
  }

  if (toolId === "cyberpunk2077-redlauncher") {
    return {
      handled: false,
      executable: path.join(gamePath, RED_LAUNCHER_RELATIVE_PATH),
      args: ["-modded"],
      options: { shell: false, detach: true, expectSuccess: true },
    };
  }

  return { handled: false, executable, args };
}

function hasConfigExtension(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === ".ini" || extension === ".json" || extension === ".xml";
}

function hasKnownTopLevel(filePath: string): boolean {
  return KNOWN_TOPLEVEL_DIRS.has(filePath.split("\\")[0].toLowerCase());
}

function isArchiveLike(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === ".archive" || extension === ".xl";
}

function startsWithPath(filePath: string, prefix: string): boolean {
  const normalizedPath = normalizeRelative(filePath);
  const normalizedPrefix = normalizeRelative(prefix);
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}\\`);
}

function normalizeRelative(filePath: string): string {
  return path.normalize(filePath).replace(/^\.\\/, "").replace(/^[\\\/]+/, "");
}

function deriveArchiveName(archivePath?: string): string {
  if (archivePath === undefined) {
    return "AutoconvertedArchive";
  }

  return path.basename(archivePath, path.extname(archivePath));
}

function makeAttributeInstruction(
  key: string,
  value: unknown,
): InternalGameInstruction {
  return {
    type: "attribute",
    key,
    value,
  };
}

async function hasMissingFiles(
  gamePath: string,
  requiredFiles: string[],
): Promise<boolean> {
  for (const file of requiredFiles) {
    try {
      await access(path.join(gamePath, file));
    } catch {
      return true;
    }
  }

  return false;
}

function redmodActionUrl(store?: string): string | undefined {
  if (store === "steam") {
    return "https://store.steampowered.com/app/2060310/Cyberpunk_2077_REDmod/";
  }
  if (store === "gog") {
    return "https://www.gog.com/en/game/cyberpunk_2077_redmod";
  }
  if (store === "epic") {
    return "https://store.epicgames.com/en-US/p/cyberpunk-2077";
  }
  return "https://www.cyberpunk.net/en/modding-support";
}

function redmodActionLabel(store?: string): string {
  if (store === "steam") return "Open REDmod on Steam";
  if (store === "gog") return "Open REDmod on GOG";
  if (store === "epic") return "Open Cyberpunk on Epic";
  return "Open REDmod help";
}
