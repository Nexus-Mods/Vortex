import type { components } from "@vortex/nexus-api-v3";

import { log } from "@/logging";

import type { IAvailableExtension } from "../../types/extensions";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { createVortexNexusV3Client } from "../nexus_integration/nexusV3Client";

/**
 * Boundary to GET /v3/vortex/extensions: everything past this module works
 * with IAvailableExtension, the wire types stay in here.
 */
export type VortexAsset = components["schemas"]["VortexAsset"];
export type VortexExtension = components["schemas"]["VortexExtension"];
export type VortexTranslation = components["schemas"]["VortexTranslation"];
export type VortexData = components["schemas"]["VortexData"];

/** Parse to a finite number, or undefined; blank strings are not numbers. */
function finite(value: string | null | undefined): number | undefined {
  if (value == null || value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toAvailableExtension(
  asset: VortexAsset,
  extras: Pick<IAvailableExtension, "type" | "gameId" | "language">,
): IAvailableExtension | undefined {
  const modId = finite(asset.mod_id);
  const fileId = finite(asset.file_id);
  if (modId === undefined || fileId === undefined) return undefined;

  const timestamp = Date.parse(asset.uploaded_at);

  return {
    name: asset.name,
    modId,
    fileId,
    author: asset.author_name,
    version: asset.version,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    image: asset.image_url ?? undefined,
    ...extras,
  };
}

/** Map the wire response to the internal model, dropping unusable entries. */
export function mapAvailableExtensions(data: VortexData): IAvailableExtension[] {
  const mapped = [
    ...data.extensions.map((ext) =>
      toAvailableExtension(ext, {
        type: ext.type === "game" ? "game" : undefined,
        gameId: finite(ext.game_id),
      }),
    ),
    ...data.themes.map((theme) => toAvailableExtension(theme, { type: "theme" })),
    ...data.translations.map((translation) =>
      toAvailableExtension(translation, {
        type: "translation",
        language: translation.locale ?? undefined,
      }),
    ),
  ];

  const result = mapped.filter((entry): entry is IAvailableExtension => entry !== undefined);
  const dropped = mapped.length - result.length;
  if (dropped > 0) {
    log("debug", "dropped extension entries with unusable ids", { dropped });
  }
  return result;
}

/** Group game extensions by the game they claim; other entries are not included. */
export function groupGameExtensionsByGameId(
  extensions: IAvailableExtension[],
): Map<number, IAvailableExtension[]> {
  // keyed by numeric Nexus Mods game ID
  const groups = new Map<number, IAvailableExtension[]>();
  for (const ext of extensions) {
    if (ext.type !== "game" || ext.gameId === undefined) continue;
    const group = groups.get(ext.gameId);
    if (group === undefined) {
      groups.set(ext.gameId, [ext]);
    } else {
      group.push(ext);
    }
  }
  return groups;
}

/**
 * Keep one game extension per game. The API de-dups already but this is a last effort check.
 */
export function dedupeGameExtensions(extensions: IAvailableExtension[]): IAvailableExtension[] {
  const beats = (challenger: IAvailableExtension, champion: IAvailableExtension): boolean => {
    return challenger.timestamp > champion.timestamp;
  };

  const winners = new Set<IAvailableExtension>();
  for (const group of groupGameExtensionsByGameId(extensions).values()) {
    winners.add(group.reduce((champion, ext) => (beats(ext, champion) ? ext : champion)));
  }

  const result = extensions.filter(
    (ext) => ext.type !== "game" || ext.gameId === undefined || winners.has(ext),
  );
  const dropped = extensions.length - result.length;
  if (dropped > 0) {
    log("info", "dropped extensions for games claimed more than once", { dropped });
  }
  return result;
}

/** Fetch and map the extension list. */
export async function fetchExtensionList(api: IExtensionApi): Promise<IAvailableExtension[]> {
  log("info", "downloading extension list");
  const data = await createVortexNexusV3Client(api).getVortexExtensions();
  return mapAvailableExtensions(data);
}
