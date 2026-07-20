import type { IExtensionApi } from "@/types/IExtensionContext";

import { openFilePage, openModPage } from "./fileRequirementActions";
import type { IDownloadedFile, IInstalledFile } from "./installedFiles";
import type { IFileRequirementCandidate } from "./mapRequirementsReport";

// Helpers shared by the requirement cards: the mod-page / file-page open handlers,
// the mappers that adapt a requirement's domain objects into the base
// FileRequirement card's props, and the action-context shape threaded to the cards.

/** Display data for one file in a requirement — a download candidate or an installed file. */
export interface IFileRequirementData {
  /** Composite file version id, used by the action handlers. */
  fileUID: string;
  adultContent: boolean;
  modName: string;
  modDescription: string;
  modImageSrc: string;
  fileName: string;
  fileVersion: string;
  /** Whether this file is installed (false for a download candidate). */
  installed: boolean;
  /** Whether this installed file is enabled (ignored when not installed). */
  enabled: boolean;
}

/** The action context threaded down to the requirement cards. */
export interface IFileActionContext {
  api: IExtensionApi;
  showPremiumAd: boolean;
  /** Download a candidate, opening the premium upsell first for free users. Resolves to whether a download ran. */
  requestDownload: (candidate: IFileRequirementCandidate) => Promise<boolean>;
  /** Appearance for a card's install button; demoted to "moderate" when an "install all" is shown. */
  installButtonAppearance?: "strong" | "moderate";
  /** True while "install all" is running; puts every card's install button into the loading state. */
  isDownloadingAll?: boolean;
}

/** Mod-page / file-page open handlers for a candidate or installed file. */
export const fileWebLinks = (api: IExtensionApi, ref: { fileUID: string; modUID: string }) => ({
  onOpenMod: () => openModPage(api, ref),
  onOpenFile: () => openFilePage(api, ref),
});

export const candidateToFileData = (
  candidate: IFileRequirementCandidate,
): IFileRequirementData => ({
  fileUID: candidate.fileUID,
  adultContent: candidate.adultContent,
  modName: candidate.modName,
  modDescription: candidate.modSummary ?? "",
  modImageSrc: candidate.thumbnailUrl ?? "",
  fileName: candidate.fileName,
  fileVersion: candidate.version,
  installed: false,
  enabled: false,
});

export const installedToFileData = (file: IInstalledFile): IFileRequirementData => ({
  fileUID: file.fileUID,
  adultContent: file.adultContent,
  modName: file.modName,
  modDescription: "",
  modImageSrc: file.thumbnailUrl ?? "",
  fileName: file.fileName,
  fileVersion: file.version,
  installed: true,
  enabled: file.enabled,
});

export const downloadedToFileData = (file: IDownloadedFile): IFileRequirementData => ({
  fileUID: file.fileUID,
  adultContent: file.adultContent,
  modName: file.modName,
  modDescription: file.modSummary ?? "",
  modImageSrc: file.thumbnailUrl ?? "",
  fileName: file.fileName,
  fileVersion: file.version,
  installed: false,
  enabled: false,
});
