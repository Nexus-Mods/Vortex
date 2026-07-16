import React from "react";
import { useTranslation } from "react-i18next";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { Typography } from "@/ui/components/typography/Typography";

import { CandidateCard } from "./CandidateCard";
import { EnableCard } from "./EnableCard";

/** OR report: pick one alternative. Each branch is a download or an enable/switch action. */
export const OrCard = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "or" }>;
}) => {
  const { t } = useTranslation("health_check");
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
        {requirement.branches.map((branch) =>
          branch.kind === "download" ? (
            <CandidateCard
              candidate={branch.candidate}
              ctx={ctx}
              isOr={true}
              key={branch.modFileId}
            />
          ) : (
            <EnableCard
              api={ctx.api}
              correctFile={branch.correctFile}
              enabledFile={branch.enabledFile}
              isOr={true}
              key={branch.modFileId}
            />
          ),
        )}
      </div>
    </div>
  );
};
