import { knownGames } from "@/extensions/gamemode_management/selectors";
import type {
  IDownloadedFile,
  IFileRequirementCandidate,
  IInstalledFile,
} from "@/extensions/health_check/types";
import { shouldShowPremiumAd } from "@/extensions/nexus_integration/selectors";
import { nexusGames } from "@/extensions/nexus_integration/util";
import { convertGameIdReverse } from "@/extensions/nexus_integration/util/convertGameId";
import { decodeUID } from "@/extensions/nexus_integration/util/UIDs";
import { setModsEnabled } from "@/extensions/profile_management/actions/profiles";
import { activeProfile } from "@/extensions/profile_management/selectors";
import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { opn, renderModName, sanitizeCSSId } from "@/util/api";

// File-level requirement actions: web links, single-file download, reveal-in-loadout,
// and enable / switch active version.

/** A file and its mod on Nexus, referenced by the composite UIDs. */
interface INexusFileRef {
  /** Composite file version id: (gameId << 32) | fileId. */
  fileUID: string;
  /** Composite mod id: (gameId << 32) | modId. Empty only when the source data lacks it. */
  modUID: string;
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

/**
 * Download and install a missing / wrong-version file. Free users can't 1-click install,
 * so open the file page instead (website download); the premium upsell is out of MVP scope.
 */
export async function downloadFileRequirement(
  api: IExtensionApi,
  candidate: IFileRequirementCandidate,
): Promise<void> {
  if (shouldShowPremiumAd(api.getState())) {
    openFilePage(api, candidate);
    return;
  }

  const mod = decodeUID(candidate.modUID);
  const file = decodeUID(candidate.fileUID);
  const domain = mod ? nexusDomain(mod.gameId) : undefined;
  if (!mod || !file || !domain) {
    log("warn", "cannot download file requirement: unresolved ids", {
      fileUID: candidate.fileUID,
    });
    return;
  }

  // The downloader keys downloads on Vortex's internal game id, not the Nexus domain.
  const internalGameId = convertGameIdReverse(knownGames(api.getState()), domain) || domain;
  const nxmUrl = `nxm://${domain}/mods/${mod.id}/files/${file.id}`;
  try {
    const dlId = await new Promise<string>((resolve, reject) =>
      api.events.emit(
        "start-download",
        [nxmUrl],
        { game: internalGameId, name: candidate.fileName, fileId: file.id, modId: mod.id },
        undefined,
        (err: Error | null, res: string) => (err ? reject(err) : resolve(res)),
        undefined,
        { allowInstall: false },
      ),
    );
    await new Promise<string>((resolve, reject) =>
      api.events.emit(
        "start-install-download",
        dlId,
        { allowAutoEnable: true },
        (err: Error | null, res: string) => (err ? reject(err) : resolve(res)),
      ),
    );
  } catch (err) {
    api.showErrorNotification(`Failed to install requirement: ${candidate.modName}`, err, {
      allowReport: false,
    });
  }
}

/**
 * Install a file that has already been downloaded. Uses the download ID directly
 * as the archive ID - no mod-store lookup needed. No premium gate applies since
 * the file is already local.
 */
export async function installDownloadedFile(
  api: IExtensionApi,
  file: IDownloadedFile,
): Promise<void> {
  try {
    await new Promise<string>((resolve, reject) =>
      api.events.emit(
        "start-install-download",
        file.downloadId,
        { allowAutoEnable: true },
        (err: Error | null, res: string) => (err ? reject(err) : resolve(res)),
      ),
    );
  } catch (err) {
    api.showErrorNotification(`Failed to install requirement: ${file.modName}`, err, {
      allowReport: false,
    });
  }
}

/** Enable an owned-but-disabled file so it satisfies the requirement. */
export function enableInstalledFile(api: IExtensionApi, file: IInstalledFile): void {
  const profile = activeProfile(api.getState());
  if (!profile) {
    log("warn", "cannot enable installed file: no active profile", { modId: file.modId });
    return;
  }
  void setModsEnabled(api, profile.id, [file.modId], true, { reason: "health_check" });
}

/** One active-version switch: disable `wrong`, enable `correct`. */
export interface ISwitchTarget {
  wrong: IInstalledFile;
  correct: IInstalledFile;
}

/**
 * Switch the active version for one or more chains: disable the wrong enabled versions,
 * then enable the correct ones, so only the correct version of each chain stays enabled.
 * Batched into two dispatches so switching several versions in a report deploys once,
 * mirroring the mod-list version switcher.
 */
export function switchActiveVersions(api: IExtensionApi, targets: ISwitchTarget[]): void {
  const profile = activeProfile(api.getState());
  if (!profile) {
    log("warn", "cannot switch active version: no active profile", { count: targets.length });
    return;
  }
  const correctIds = [...new Set(targets.map((target) => target.correct.modId))];
  if (correctIds.length === 0) {
    return;
  }
  const correctSet = new Set(correctIds);
  // Never disable a version another target is enabling (or that is already correct).
  const wrongIds = [...new Set(targets.map((target) => target.wrong.modId))].filter(
    (id) => !correctSet.has(id),
  );
  void setModsEnabled(api, profile.id, wrongIds, false, { reason: "health_check" }).then(() =>
    setModsEnabled(api, profile.id, correctIds, true, { reason: "health_check" }),
  );
}

/** Switch the active version: enable `correct`, disabling the currently-enabled `wrong`. */
export function switchActiveVersion(
  api: IExtensionApi,
  wrong: IInstalledFile,
  correct: IInstalledFile,
): void {
  if (wrong.modId === correct.modId) {
    return;
  }
  switchActiveVersions(api, [{ wrong, correct }]);
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

/**
 * The mod-list row to reveal for an installed file. Vortex collapses a mod's installed
 * versions into one row (the enabled one), so a disabled version has no row of its own;
 * fall back to the enabled sibling of the same mod so the scroll / highlight lands.
 */
function loadoutRowModId(api: IExtensionApi, file: IInstalledFile): string {
  const state = api.getState();
  const profile = activeProfile(state);
  const gameId = profile?.gameId;
  if (!gameId) {
    return file.modId;
  }
  const mods = state.persistent.mods[gameId] ?? {};
  const self = mods[file.modId];
  const isEnabled = (id: string): boolean => profile?.modState?.[id]?.enabled === true;
  if (self === undefined || isEnabled(file.modId)) {
    return file.modId;
  }
  const name = renderModName(self);
  const nexusModId = self.attributes?.modId;
  const sibling = Object.keys(mods).find(
    (id) =>
      isEnabled(id) &&
      mods[id].attributes?.modId === nexusModId &&
      renderModName(mods[id]) === name,
  );
  return sibling ?? file.modId;
}

/**
 * Navigate to the Mods page and highlight the row for a downloaded-but-not-installed
 * archive, using the download ID as the row key.
 */
export function viewDownloadInMods(api: IExtensionApi, file: IDownloadedFile): void {
  api.events.emit("show-main-page", "Mods");
  setTimeout(() => {
    api.events.emit("mods-scroll-to", file.downloadId);
    api.highlightControl(`.${sanitizeCSSId(file.downloadId)}`, 5000);
  }, 2000);
}

/**
 * Reveal the mod in the Mods view: navigate, then scroll to and highlight its row (as the
 * collections "Show in Mods" action does). The delay lets the mods table mount first.
 */
export function viewInLoadout(api: IExtensionApi, file: IInstalledFile): void {
  const rowModId = loadoutRowModId(api, file);
  api.events.emit("show-main-page", "Mods");
  setTimeout(() => {
    api.events.emit("mods-scroll-to", rowModId);
    api.highlightControl(`.${sanitizeCSSId(rowModId)}`, 5000);
  }, 2000);
}
