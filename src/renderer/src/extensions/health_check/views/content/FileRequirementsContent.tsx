import { mdiChevronRight, mdiDownload, mdiOpenInNew, mdiSwapHorizontal } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import { FILE_REQUIREMENTS_CHECK_ID } from "../../checks/fileRequirementsCheck";
import {
  FileRequirement,
  type IFileRequirementData,
} from "../../components/file_requirement/FileRequirement";
import { fileRequirementsCheckResult } from "../../selectors";
import type {
  IFileLevelRequirements,
  IFileRequirement,
  IFileRequirementCandidate,
  IInstalledFile,
} from "../../types";
import {
  downloadFileRequirement,
  openModPage,
  switchActiveVersion,
  viewInLoadout,
} from "../../utils/fileRequirementActions";
import { severityStyleMap } from "../../utils/severityStyles";
import type { IDetailViewProps, IHealthCheckContent, IListingRowProps } from "./types";

function candidateToFileData(candidate: IFileRequirementCandidate): IFileRequirementData {
  return {
    fileUID: candidate.fileUID,
    adultContent: candidate.adultContent,
    modName: candidate.modName,
    modDescription: candidate.modSummary ?? "",
    modImageSrc: candidate.thumbnailUrl ?? "",
    fileName: candidate.fileName,
    fileVersion: candidate.version,
    installed: false,
    enabled: false,
  };
}

function installedToFileData(file: IInstalledFile): IFileRequirementData {
  return {
    fileUID: file.fileUID,
    adultContent: file.adultContent,
    modName: file.modName,
    modDescription: "",
    modImageSrc: file.thumbnailUrl ?? "",
    fileName: file.fileName,
    fileVersion: file.version,
    installed: true,
    enabled: file.enabled,
  };
}

/** A download/enable card for one candidate (used by missing + wrong-version-installed). */
function CandidateCard({
  api,
  candidate,
  isOr,
}: {
  api: IDetailViewProps["api"];
  candidate: IFileRequirementCandidate;
  isOr?: boolean;
}) {
  const { t } = useTranslation(["health_check", "common"]);
  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiOpenInNew}
            size="sm"
            onClick={() => openModPage(api, candidate)}
          >
            {t("detail::item::install_via_mod_page")}
          </Button>

          <Button
            appearance="strong"
            brand="neutral"
            leftIconPath={mdiDownload}
            size="sm"
            onClick={() => downloadFileRequirement(api, candidate)}
          >
            {t("detail::item::install_one_click")}
          </Button>
        </>
      }
      file={candidateToFileData(candidate)}
      isOr={isOr}
    />
  );
}

function MissingRequirement({
  api,
  requirement,
}: {
  api: IDetailViewProps["api"];
  requirement: Extract<IFileRequirement, { kind: "missing" }>;
}) {
  const { t } = useTranslation("health_check");
  if (requirement.alternatives.length <= 1) {
    return <CandidateCard api={api} candidate={requirement.alternatives[0]} />;
  }
  return (
    <div>
      <Typography
        appearance="moderate"
        brand="neutral-translucent"
        className="rounded-t-lg bg-surface-mid px-3 py-2 font-semibold"
      >
        {t("detail::item::pick_one")}
      </Typography>

      <div className="rounded-b-lg border-x border-b border-stroke-weak p-3">
        {requirement.alternatives.map((candidate) => (
          <CandidateCard api={api} candidate={candidate} isOr={true} key={candidate.fileUID} />
        ))}
      </div>
    </div>
  );
}

function WrongVersionInstalled({
  api,
  requirement,
}: {
  api: IDetailViewProps["api"];
  requirement: Extract<IFileRequirement, { kind: "wrong-version-installed" }>;
}) {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography appearance="subdued">{t("detail::item::wrong_version_installed")}</Typography>

      <Typography appearance="subdued" className="mt-1 mb-2">
        {t("detail::item::installed_version")}
      </Typography>

      <FileRequirement
        actions={
          <Button
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={() => viewInLoadout(api, requirement.installedFile)}
          >
            {t("detail::item::view_in_loadout")}
          </Button>
        }
        file={installedToFileData(requirement.installedFile)}
      />

      <Typography appearance="subdued" className="mt-4 mb-2">
        {t("detail::item::required_version")}
      </Typography>

      {requirement.alternatives.map((candidate) => (
        <CandidateCard api={api} candidate={candidate} key={candidate.fileUID} />
      ))}
    </div>
  );
}

function WrongVersionEnabled({
  api,
  requirement,
}: {
  api: IDetailViewProps["api"];
  requirement: Extract<IFileRequirement, { kind: "wrong-version-enabled" }>;
}) {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography appearance="subdued">{t("detail::item::wrong_version_enabled")}</Typography>

      <Typography appearance="subdued" className="mt-1 mb-2">
        {t("detail::item::enabled_version")}
      </Typography>

      <FileRequirement file={installedToFileData(requirement.enabledFile)} />

      <Typography appearance="subdued" className="mt-4 mb-2">
        {t("detail::item::correct_version")}
      </Typography>

      <FileRequirement
        actions={
          <Button
            appearance="strong"
            brand="neutral"
            leftIconPath={mdiSwapHorizontal}
            size="sm"
            onClick={() =>
              switchActiveVersion(api, requirement.enabledFile, requirement.correctFile)
            }
          >
            {t("detail::item::switch_version")}
          </Button>
        }
        file={installedToFileData(requirement.correctFile)}
      />
    </div>
  );
}

function FileRequirementsListingRow({ entry, onOpen }: IListingRowProps) {
  const { t } = useTranslation("health_check");
  const data = entry.data as IFileLevelRequirements;
  const severityStyle = severityStyleMap[entry.severity];

  return (
    <div
      className="group hover-overlay-weak flex w-full cursor-pointer items-center gap-x-4 rounded-sm bg-surface-mid px-4 py-3 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info-subdued"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (["Enter", " "].includes(e.key)) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <Icon
        className={joinClasses(["shrink-0", severityStyle.textClassName])}
        path={severityStyle.iconPath}
      />

      <div className="min-w-0 grow text-left">
        <Typography className="truncate">{data.sourceModName}</Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {t("listing::item::requires_files", { count: data.requirements.length })}
        </Typography>
      </div>

      <Icon className="shrink-0 text-translucent-moderate" path={mdiChevronRight} size="lg" />
    </div>
  );
}

function FileRequirementsDetailView({ entry, api }: IDetailViewProps) {
  const { t } = useTranslation("health_check");
  const data = entry.data as IFileLevelRequirements;

  return (
    <div className="space-y-6">
      <Typography appearance="subdued">
        {t("detail::item::requires_files", { count: data.requirements.length })}
      </Typography>

      {data.requirements.map((requirement) => {
        switch (requirement.kind) {
          case "missing":
            return (
              <MissingRequirement
                api={api}
                key={requirement.requirementId}
                requirement={requirement}
              />
            );
          case "wrong-version-installed":
            return (
              <WrongVersionInstalled
                api={api}
                key={requirement.requirementId}
                requirement={requirement}
              />
            );
          case "wrong-version-enabled":
            return (
              <WrongVersionEnabled
                api={api}
                key={requirement.requirementId}
                requirement={requirement}
              />
            );
        }
      })}
    </div>
  );
}

export const fileRequirementsContent: IHealthCheckContent = {
  selectEntries: (state) => {
    const result = fileRequirementsCheckResult(state);
    if (!result) {
      return [];
    }
    return Object.values(result).map((requirements) => ({
      id: requirements.sourceFileUID,
      checkId: FILE_REQUIREMENTS_CHECK_ID,
      severity: "warning",
      data: requirements,
    }));
  },
  ListingRow: FileRequirementsListingRow,
  DetailView: FileRequirementsDetailView,
  // TODO(LAZ-590 follow-up): add file-level hide state (own persistent map keyed by sourceFileUID).
  supportsHide: false,
};
