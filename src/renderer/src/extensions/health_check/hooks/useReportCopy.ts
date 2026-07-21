import { useTranslation } from "react-i18next";

import type { IFileRequirementReport } from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";

/** The localized title and summary for a report, by category and entry count. */
export const useReportCopy = (report: IFileRequirementReport) => {
  const { t } = useTranslation(["health_check", "common"]);
  const count = report.requirements.length;
  const title = t(count > 1 ? "listing::item::missing_for_plural" : "listing::item::missing_for", {
    modName: report.sourceModName,
  });
  const summary =
    report.category === "or"
      ? t(count > 1 ? "listing::item::requires_pick_plural" : "listing::item::requires_pick", {
          count,
        })
      : t(count > 1 ? "shared::requires_files_plural" : "shared::requires_files", {
          count,
        });
  return { title, summary };
};
