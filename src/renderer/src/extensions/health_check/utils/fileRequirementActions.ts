import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IFileRequirementCandidate, IInstalledFile } from "../types";

// File-level requirement actions. These are intentionally stubs for now: the UI
// is wired to call them, but the real behaviour (nxm download, enabling/switching
// the active version, opening the mod page, revealing in the loadout) is
// implemented once the resolver + v3 ports are bound.
//
// TODO(LAZ-590 follow-up): implement each of these.

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

/** Reveal an installed file in the mods/loadout view. */
export function viewInLoadout(_api: IExtensionApi, file: IInstalledFile): void {
  log("info", "TODO: view in loadout", { modId: file.modId });
}
