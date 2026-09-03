import type { components } from "@vortex/nexus-api-v3";

import { log } from "@/logging";

import type { IAvailableExtension } from "../../types/extensions";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { createVortexNexusV3Client } from "../nexus_integration/nexusV3Client";
import { languageCodeByEnglishName } from "../settings_interface/languagemap";

/**
 * Boundary to GET /v3/vortex/extensions: everything past this module works
 * with IAvailableExtension, the wire types stay in here.
 */
export type VortexAsset = components["schemas"]["VortexAsset"];
export type VortexExtension = components["schemas"]["VortexExtension"];
export type VortexTranslation = components["schemas"]["VortexTranslation"];
export type VortexData = components["schemas"]["VortexData"];

/**
 * Derive a locale code from a translation's mod name. The endpoint carries no
 * locale field, so match an explicit code like "(pt-BR)" or an English
 * language name like "German".
 */
export function parseTranslationLocale(name: string): string | undefined {
  const explicit = /\(([a-z]{2})(?:-([a-z]{2}))?\)/i.exec(name);
  if (explicit !== null) {
    const [, language, country] = explicit;
    return country !== undefined
      ? `${language.toLowerCase()}-${country.toUpperCase()}`
      : language.toLowerCase();
  }

  const words = name
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length > 0);

  // longest window first so multi-word names win over their parts; 3 covers
  // the longest languagemap entry ("Old Church Slavonic")
  for (let size = 3; size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      const code = languageCodeByEnglishName(words.slice(start, start + size).join(" "));
      if (code !== undefined) return code;
    }
  }
  return undefined;
}

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
        language: translation.locale ?? parseTranslationLocale(translation.name),
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
 * Keep one game extension per game: nothing stops several extensions for the
 * same game from being listed, so the most endorsed wins and the newest upload
 * breaks ties. Everything else passes through unchanged.
 */
export function dedupeGameExtensions(
  extensions: IAvailableExtension[],
  // keyed by mod ID
  endorsementsByModId: Record<number, number>,
): IAvailableExtension[] {
  const beats = (challenger: IAvailableExtension, champion: IAvailableExtension): boolean => {
    const challengerVotes = endorsementsByModId[challenger.modId] ?? 0;
    const championVotes = endorsementsByModId[champion.modId] ?? 0;
    if (challengerVotes !== championVotes) return challengerVotes > championVotes;
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
