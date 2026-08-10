import { useTranslation } from "react-i18next";

import type {
  FileRequirementCategory,
  IFileRequirementReport,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";

/** Shared-namespace summary key per report category. Pluralised via `_plural`. */
const summaryKeyByCategory: Record<FileRequirementCategory, string> = {
  download: "shared::requires_files",
  "download-replace": "shared::wrong_version_installed",
  "install-uninstalled": "shared::correct_version_uninstalled",
  toggle: "shared::wrong_version_enabled",
  or: "shared::requires_pick",
};

/** The localized title and summary for a report, by category and entry count. */
export const useReportCopy = (report: IFileRequirementReport) => {
  const { t } = useTranslation(["health_check", "common"]);

  const count = report.requirements.length;
  const summaryKey = summaryKeyByCategory[report.category];

  return {
    title: t(count > 1 ? "listing::item::missing_for_plural" : "listing::item::missing_for", {
      modName: report.sourceModName,
    }),
    summary: t(count > 1 ? `${summaryKey}_plural` : summaryKey, { count }),
  };
};
