import { mdiSwapHorizontal } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  fileWebLinks,
  installedToFileData,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import {
  enableInstalledFile,
  switchActiveVersion,
  viewInLoadout,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IInstalledFile } from "@/extensions/health_check/utils/fileRequirements/installedFiles";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { nxmModOutline } from "@/ui/icon-paths";

import { FileRequirement } from "../FileRequirement";

/** A "switch to this disabled version" card for one installed file (toggle + OR enable). */
export const EnableCard = ({
  api,
  correctFile,
  enabledFile,
  isOr,
}: {
  api: IExtensionApi;
  correctFile: IInstalledFile;
  /** The wrong version to switch off, if any; absent means a plain enable. */
  enabledFile?: IInstalledFile;
  isOr?: boolean;
}) => {
  const { t } = useTranslation("health_check");

  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={nxmModOutline}
            size="sm"
            onClick={() => viewInLoadout(api, correctFile)}
          >
            {t("detail::item::view_in_mods")}
          </Button>

          <Button
            appearance="strong"
            brand="neutral"
            leftIconPath={mdiSwapHorizontal}
            size="sm"
            onClick={() =>
              enabledFile
                ? switchActiveVersion(api, enabledFile, correctFile)
                : enableInstalledFile(api, correctFile)
            }
          >
            {t("detail::item::enable_this_version")}
          </Button>
        </>
      }
      file={installedToFileData(correctFile)}
      isOr={isOr}
      {...fileWebLinks(api, correctFile)}
    />
  );
};
