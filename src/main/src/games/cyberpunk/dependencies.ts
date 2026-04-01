import type {
  DiagnosticResult,
  InternalGameRuntimeSnapshot,
  Serializable,
} from "@vortex/shared/ipc";

const CONTENT_SIGNALS_ATTRIBUTE = "V2077_mod_attr_content_signals";

export interface ICyberpunkContentSignals {
  hasArchiveXL?: boolean;
  hasCetLua?: boolean;
  hasRed4ExtPlugin?: boolean;
  hasReds?: boolean;
  hasRedmod?: boolean;
  hasTweaks?: boolean;
}

interface ICyberpunkDependencyRule {
  id: string;
  label: string;
  modId: number;
  isInstalled: (runtime: InternalGameRuntimeSnapshot) => boolean;
  isRequired: (signals: ICyberpunkContentSignals) => boolean;
}

const DEPENDENCY_RULES: ICyberpunkDependencyRule[] = [
  {
    id: "cyber-engine-tweaks",
    label: "Cyber Engine Tweaks",
    modId: 107,
    isInstalled: (runtime) =>
      runtimeHasPathPrefix(runtime, "bin\\x64\\plugins\\cyber_engine_tweaks"),
    isRequired: (signals) => signals.hasCetLua === true,
  },
  {
    id: "red4ext",
    label: "RED4Ext",
    modId: 2380,
    isInstalled: (runtime) =>
      runtimeHasPathPrefix(runtime, "red4ext\\plugins"),
    isRequired: (signals) =>
      signals.hasRed4ExtPlugin === true
      || signals.hasArchiveXL === true
      || signals.hasTweaks === true,
  },
  {
    id: "archivexl",
    label: "ArchiveXL",
    modId: 4198,
    isInstalled: (runtime) =>
      runtimeHasPathPrefix(runtime, "red4ext\\plugins\\archivexl"),
    isRequired: (signals) => signals.hasArchiveXL === true,
  },
  {
    id: "tweakxl",
    label: "TweakXL",
    modId: 4197,
    isInstalled: (runtime) =>
      runtimeHasPathPrefix(runtime, "red4ext\\plugins\\tweakxl"),
    isRequired: (signals) => signals.hasTweaks === true,
  },
  {
    id: "codeware",
    label: "Codeware",
    modId: 7780,
    isInstalled: (runtime) =>
      runtimeHasPathPrefix(runtime, "red4ext\\plugins\\codeware"),
    isRequired: (signals) => signals.hasReds === true || signals.hasCetLua === true,
  },
];

export function detectContentSignals(files: string[]): ICyberpunkContentSignals {
  const lowerFiles = files.map((file) => file.toLowerCase());
  return {
    hasArchiveXL: lowerFiles.some(
      (file) =>
        file.endsWith(".xl")
        || file.includes("\\archivexl\\")
        || file.includes("/archivexl/"),
    ),
    hasCetLua: lowerFiles.some(
      (file) =>
        file.endsWith(".lua")
        || file.includes("bin\\x64\\plugins\\cyber_engine_tweaks\\mods\\")
        || file.includes("bin/x64/plugins/cyber_engine_tweaks/mods/"),
    ),
    hasRed4ExtPlugin: lowerFiles.some(
      (file) =>
        file.includes("red4ext\\plugins\\")
        || file.includes("red4ext/plugins/"),
    ),
    hasReds: lowerFiles.some((file) => file.endsWith(".reds")),
    hasRedmod: lowerFiles.some(
      (file) => file.startsWith("mods\\") || file.includes("\\mods\\"),
    ),
    hasTweaks: lowerFiles.some(
      (file) =>
        file.startsWith("r6\\tweaks\\")
        || file.includes("\\r6\\tweaks\\")
        || file.includes("/r6/tweaks/"),
    ),
  };
}

export function serializeContentSignals(
  signals: ICyberpunkContentSignals,
): Serializable {
  return signals as Serializable;
}

export function getContentSignalsAttributeKey(): string {
  return CONTENT_SIGNALS_ATTRIBUTE;
}

export function collectDependencyDiagnostics(
  runtime: InternalGameRuntimeSnapshot,
  genericRequiredBy: { modId: number; modName: string; modUrl?: string },
  gameId: string,
): DiagnosticResult[] {
  const signals = collectRuntimeContentSignals(runtime);

  return DEPENDENCY_RULES
    .filter((rule) => rule.isRequired(signals) && !rule.isInstalled(runtime))
    .map((rule) => ({
      id: `cyberpunk-missing-${rule.id}`,
      level: "warning" as const,
      kind: "missing-dependency" as const,
      title: `${rule.label} may be required`,
      message: `Detected content that commonly depends on ${rule.label}, but ${rule.label} is not installed or could not be detected.`,
      fixType: "nexus-dependency" as const,
      canonicalDependencyGameId: gameId,
      canonicalDependencyModId: rule.modId,
      dependency: {
        gameId,
        modId: rule.modId,
        modName: rule.label,
      },
      requiredBy: genericRequiredBy,
      requiredByModId: "cyberpunk-setup",
    }));
}

function collectRuntimeContentSignals(
  runtime: InternalGameRuntimeSnapshot,
): ICyberpunkContentSignals {
  return (runtime.mods ?? []).reduce<ICyberpunkContentSignals>((accum, mod) => {
    const next = extractContentSignalsFromAttributes(mod.attributes);
    accum.hasArchiveXL ||= next.hasArchiveXL === true;
    accum.hasCetLua ||= next.hasCetLua === true;
    accum.hasRed4ExtPlugin ||= next.hasRed4ExtPlugin === true;
    accum.hasReds ||= next.hasReds === true;
    accum.hasRedmod ||= next.hasRedmod === true;
    accum.hasTweaks ||= next.hasTweaks === true;
    return accum;
  }, {});
}

function extractContentSignalsFromAttributes(
  attributes: Record<string, Serializable> | undefined,
): ICyberpunkContentSignals {
  const value = attributes?.[CONTENT_SIGNALS_ATTRIBUTE];
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const data =
    "data" in value
      && value.data != null
      && typeof value.data === "object"
      && !Array.isArray(value.data)
      ? (value.data as Record<string, Serializable>)
      : (value as Record<string, Serializable>);

  return {
    hasArchiveXL: data["hasArchiveXL"] === true,
    hasCetLua: data["hasCetLua"] === true,
    hasRed4ExtPlugin: data["hasRed4ExtPlugin"] === true,
    hasReds: data["hasReds"] === true,
    hasRedmod: data["hasRedmod"] === true,
    hasTweaks: data["hasTweaks"] === true,
  };
}

function runtimeHasPathPrefix(
  runtime: InternalGameRuntimeSnapshot,
  prefix: string,
): boolean {
  const normalizedPrefix = prefix.toLowerCase();
  return (runtime.loadOrder ?? []).some((entry) =>
    String(entry.data?.["sourcePath"] ?? "").toLowerCase().startsWith(normalizedPrefix),
  );
}

