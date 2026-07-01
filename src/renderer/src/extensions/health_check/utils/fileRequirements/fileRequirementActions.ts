import type { IFileRequirementCandidate, IInstalledFile } from "@/extensions/health_check/types";
import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";

// File-level requirement actions. The UI is wired to call them, but the real
// behaviour (nxm download, enabling/switching the active version, opening the mod
// page, revealing in the loadout) is not implemented yet.
//
// TODO(LAZ-471): implement each of these.

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
export function openModPage(_api: IExtensionApi, ref: { fileUID: string }): void {
  log("info", "TODO: open mod page", { fileUID: ref.fileUID });
}

/** Open the file's page on the Nexus website (the specific file, not the mod). */
export function openFilePage(_api: IExtensionApi, ref: { fileUID: string }): void {
  log("info", "TODO: open file page", { fileUID: ref.fileUID });
}

/** Reveal an installed file in the mods/loadout view. */
export function viewInLoadout(_api: IExtensionApi, file: IInstalledFile): void {
  log("info", "TODO: view in loadout", { modId: file.modId });
}
