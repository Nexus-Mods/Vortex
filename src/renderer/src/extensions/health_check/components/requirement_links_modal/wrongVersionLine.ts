import type { TFunction } from "i18next";

import type { IWrongVersion } from "../../utils/requirementLinks/requirementLinks";

/** Why the installed copy of a required mod isn't one its file-level requirement accepts. */
export const wrongVersionLine = (wrong: IWrongVersion, t: TFunction): string => {
  const { installed, wanted, differentFile } = wrong;
  if (differentFile) {
    return wanted.fileName === undefined
      ? t("requirement_links_modal::wrong_version::different_file")
      : t("requirement_links_modal::wrong_version::different_file_named", {
          fileName: wanted.fileName,
        });
  }
  const { versions } = wanted;
  if (versions === undefined) {
    return t("requirement_links_modal::wrong_version::unknown");
  }
  const needed =
    versions.oldest === versions.newest
      ? versions.newest
      : t("requirement_links_modal::wrong_version::range", versions);
  return installed === undefined
    ? t("requirement_links_modal::wrong_version::needs", { needed })
    : t("requirement_links_modal::wrong_version::installed", { installed, needed });
};
