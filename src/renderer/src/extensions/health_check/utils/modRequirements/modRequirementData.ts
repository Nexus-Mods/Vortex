import type { IModFileInfo, IModRequirementExt } from "@/extensions/health_check/types";

import type { IFileRequirementData } from "../fileRequirements/cardHelpers";

export const modToFileData = (
  mod: IModRequirementExt,
  mainFile: IModFileInfo | undefined,
): IFileRequirementData => ({
  fileUID: mod.uid,
  adultContent: mainFile?.adultContent ?? false,
  modName: mod.modName || mod.modUrl || "",
  modDescription: mainFile?.modSummary ?? "",
  modImageSrc: mainFile?.thumbnailUrl ?? "",
  fileName: mainFile?.name ?? "",
  fileVersion: mainFile?.version ?? "",
  installed: false,
  enabled: false,
});
