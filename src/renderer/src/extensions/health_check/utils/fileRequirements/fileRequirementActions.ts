import type { IFileRequirementCandidate, IInstalledFile } from "@/extensions/health_check/types";
import { nexusGames } from "@/extensions/nexus_integration/util";
import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { opn } from "@/util/api";

// File-level requirement actions. Web links (mod page / file page) are implemented;
// the nxm download, enabling/switching the active version, and revealing in the
// loadout are still stubbed.
//
// TODO(LAZ-471): implement download, enable/switch active version, and view-in-loadout.

/** A file and its mod on Nexus, referenced by the composite UIDs. */
interface INexusFileRef {
  /** Composite file version id: (gameId << 32) | fileId. */
  fileUID: string;
  /** Composite mod id: (gameId << 32) | modId. Empty only when the source data lacks it. */
  modUID: string;
}

/** Decode a composite UID (gameId << 32 | id) into its game id and low id. */
function decodeUID(uid: string): { gameId: number; id: number } | undefined {
  try {
    const value = BigInt(uid);
    return { gameId: Number(value >> BigInt(32)), id: Number(value & BigInt(0xffffffff)) };
  } catch {
    return undefined;
  }
}

/** Nexus domain name (e.g. "stardewvalley") for a numeric game id, if known. */
function nexusDomain(gameId: number): string | undefined {
  return nexusGames().find((game) => game.id === gameId)?.domain_name;
}

/** The mod page URL for a ref, or undefined when the mod id or domain can't be resolved. */
function modPageUrl(ref: INexusFileRef): string | undefined {
  // modUID is empty when the source data lacked a mod id; decode only when present.
  const mod = ref.modUID ? decodeUID(ref.modUID) : undefined;
  const domain = mod ? nexusDomain(mod.gameId) : undefined;
  return mod && domain ? `https://www.nexusmods.com/${domain}/mods/${mod.id}` : undefined;
}

/** Download a file the user doesn't have (missing / wrong-version-installed). */
export function downloadFileRequirement(
  _api: IExtensionApi,
  candidate: IFileRequirementCandidate,
): void {
  log("info", "TODO: download file requirement", { fileUID: candidate.fileUID });
}

/** Enable an installed-but-disabled file (wrong-version-enabled). */
export function enableInstalledFile(_api: IExtensionApi, file: IInstalledFile): void {
  log("info", "TODO: enable installed file", { modId: file.modId, fileUID: file.fileUID });
}

/** Switch the active version: enable `correct`, disabling the currently-enabled `wrong`. */
export function switchActiveVersion(
  _api: IExtensionApi,
  wrong: IInstalledFile,
  correct: IInstalledFile,
): void {
  log("info", "TODO: switch active version", { from: wrong.fileUID, to: correct.fileUID });
}

/** Open the mod's Nexus page for a candidate or installed file. */
export function openModPage(_api: IExtensionApi, ref: INexusFileRef): void {
  const url = modPageUrl(ref);
  if (!url) {
    log("warn", "cannot open mod page: unresolved mod id or game", { fileUID: ref.fileUID });
    return;
  }
  opn(url).catch(() => undefined);
}

/** Open the file's page on the Nexus website (the specific file, not the mod). */
export function openFilePage(_api: IExtensionApi, ref: INexusFileRef): void {
  const base = modPageUrl(ref);
  const file = decodeUID(ref.fileUID);
  if (!base || !file) {
    log("warn", "cannot open file page: unresolved mod or file id", { fileUID: ref.fileUID });
    return;
  }
  // `file_id` can reach hidden mods and archived files. An alternative form is
  //   `${base}?tab=files&show_file=${file.id}`
  // but `show_file` cannot open hidden mods or archived files (it could be updated to).
  opn(`${base}?tab=files&file_id=${file.id}&nmm=1`).catch(() => undefined);
}

/** Reveal an installed file in the mods/loadout view. */
export function viewInLoadout(_api: IExtensionApi, file: IInstalledFile): void {
  log("info", "TODO: view in loadout", { modId: file.modId });
}
