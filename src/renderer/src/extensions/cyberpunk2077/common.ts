import type {
  IDiscoveryResult,
  IExtensionApi,
  ILoadOrderEntry,
  IMod,
  LoadOrder,
} from "../../types/api";
import type {
  InternalGameLoadOrderEntry,
  InternalGameRuntimeSnapshot,
  Serializable,
} from "@vortex/shared/ipc";
import * as selectors from "../../util/selectors";
import { currentLoadOrderForProfile } from "../file_based_loadorder/selectors";

export const GAME_ID = "cyberpunk2077";
export const CYBERPUNK_ARCHIVE_INSPECTOR_PAGE_ID = "cyberpunk-archive-inspector";
export const CYBERPUNK_ARCHIVE_SELECTION_KEY = "cyberpunk.archive-inspector.selection";
export const CYBERPUNK_REDDEPLOY_TOOL_ID = "cyberpunk2077-reddeploy";

export type CyberpunkBucket = "archive" | "redmod";

export interface ICyberpunkLoadOrderData {
  bucket?: CyberpunkBucket;
  archivePath?: string;
  path?: string;
  sourcePath?: string;
  version?: string;
  kind?: string;
  sourceType?: string;
  [key: string]: unknown;
}

export interface ICyberpunkLoadOrderEntry
  extends ILoadOrderEntry<ICyberpunkLoadOrderData> {}

export function getCyberpunkApi(): any {
  return (window.api as any)?.games?.cyberpunk;
}

export function isCyberpunkActive(state: any): boolean {
  return selectors.activeGameId(state) === GAME_ID;
}

export function getCurrentCyberpunkLoadOrder(api: IExtensionApi): LoadOrder {
  const state = api.getState();
  const profile = selectors.activeProfile(state);
  if (profile?.id === undefined) {
    return [];
  }

  return currentLoadOrderForProfile(state, profile.id) ?? [];
}

export function getCyberpunkBucket(
  entry: ILoadOrderEntry<ICyberpunkLoadOrderData>,
): CyberpunkBucket {
  const data = entry?.data ?? {};
  const bucket = data.bucket ?? data.kind ?? data.sourceType;
  if (bucket === "redmod") {
    return "redmod";
  }

  const text = [data.archivePath, data.path, data.sourcePath, entry?.name, entry?.id]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return text.includes("redmod") ? "redmod" : "archive";
}

export function getCyberpunkArchivePath(
  entry: ILoadOrderEntry<ICyberpunkLoadOrderData>,
): string | undefined {
  const data = entry?.data ?? {};
  return data.archivePath ?? data.path ?? data.sourcePath;
}

export function openCyberpunkArchiveInspector(
  api?: IExtensionApi,
  archivePath?: string,
): void {
  if (archivePath) {
    window.localStorage.setItem(
      CYBERPUNK_ARCHIVE_SELECTION_KEY,
      archivePath,
    );
  }

  const eventApi = (api as any)?.events ?? (window.api as any)?.events;
  eventApi?.emit?.("show-main-page", CYBERPUNK_ARCHIVE_INSPECTOR_PAGE_ID);
}

export function formatCyberpunkBucket(bucket: CyberpunkBucket): string {
  return bucket === "redmod" ? "REDmod" : "Archive";
}

export function buildCyberpunkRuntimeSnapshot(
  api: IExtensionApi,
  overrides?: Partial<InternalGameRuntimeSnapshot>,
): InternalGameRuntimeSnapshot {
  const state = api.getState();
  const activeGameId = selectors.activeGameId(state);
  const profile = selectors.activeProfile(state);
  const discovery = selectors.currentGameDiscovery(state) as IDiscoveryResult | undefined;
  const loadOrder = profile?.id != null
    ? currentLoadOrderForProfile(state, profile.id) ?? []
    : [];
  const gameMods = activeGameId != null
    ? Object.values(selectors.modsForGame(state, activeGameId) ?? {})
    : [];

  return {
    gameId: activeGameId ?? GAME_ID,
    activeProfileId: profile?.id,
    discovery: toInternalDiscovery(discovery),
    mods: gameMods.map(toInternalMod),
    loadOrder: loadOrder.map(toInternalLoadOrderEntry),
    ...(overrides ?? {}),
  };
}

function toInternalDiscovery(
  discovery?: IDiscoveryResult,
): InternalGameRuntimeSnapshot["discovery"] {
  if (discovery == null) {
    return undefined;
  }

  return {
    path: discovery.path,
    store: discovery.store,
    tools: discovery.tools != null
      ? Object.keys(discovery.tools).reduce((accum, key) => {
          accum[key] = { path: discovery.tools[key]?.path };
          return accum;
        }, {} as Record<string, { path: string }>)
      : undefined,
  };
}

function toInternalMod(mod: IMod) {
  return {
    id: mod.id,
    name: mod.attributes?.customFileName
      ?? mod.attributes?.logicalFileName
      ?? mod.attributes?.modName
      ?? mod.installationPath
      ?? mod.id,
    enabled: mod.state === "installed",
    type: mod.type,
    fileId: mod.attributes?.fileId != null ? String(mod.attributes.fileId) : undefined,
    modId: mod.attributes?.modId != null ? String(mod.attributes.modId) : undefined,
    version: mod.attributes?.version ?? mod.attributes?.modVersion,
    attributes: serializeRecord(mod.attributes),
  };
}

function toInternalLoadOrderEntry(
  entry: ILoadOrderEntry<ICyberpunkLoadOrderData>,
): InternalGameLoadOrderEntry {
  return {
    id: entry.id,
    name: entry.name,
    enabled: entry.enabled,
    modId: entry.modId,
    data: serializeRecord(entry.data),
  };
}

function serializeRecord(
  value: Record<string, unknown> | undefined,
): Record<string, Serializable> | undefined {
  if (value == null) {
    return undefined;
  }

  const result: Record<string, Serializable> = {};
  Object.keys(value).forEach((key) => {
    const serialized = serializeValue(value[key]);
    if (serialized !== undefined) {
      result[key] = serialized;
    }
  });
  return result;
}

function serializeValue(value: unknown): Serializable | undefined {
  if (value == null) {
    return value as Serializable;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => serializeValue(entry))
      .filter((entry) => entry !== undefined) as Serializable[];
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
    case "bigint":
      return value;
    case "object":
      return serializeRecord(value as Record<string, unknown>);
    default:
      return undefined;
  }
}
