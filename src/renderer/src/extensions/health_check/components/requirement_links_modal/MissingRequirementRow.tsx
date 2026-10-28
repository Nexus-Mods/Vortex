import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";

import type {
  IMissingRequirement,
  IMissingRequirementOption,
} from "../../utils/requirementLinks/requirementLinks";
import { RequirementNote } from "./RequirementNote";

/** A file-level option's newest file and the versions it accepts, as one line. */
const fileLine = (option: IMissingRequirementOption, t: TFunction): string | undefined => {
  const { fileName, versions } = option;
  const range =
    versions === undefined
      ? undefined
      : versions.oldest === versions.newest
        ? t("requirement_links_modal::version", { version: versions.newest })
        : t("requirement_links_modal::versions", versions);
  return [fileName, range].filter((part) => part !== undefined).join(" · ") || undefined;
};

/**
 * A requirement nothing installed satisfies: the mod it needs, or each of its alternatives, with
 * the file and versions for a file-level one, and "Not installed" in place of the link choice.
 */
export const MissingRequirementRow = ({ requirement }: { requirement: IMissingRequirement }) => {
  const { t } = useTranslation("health_check");
  const names = requirement.options.map(
    (option) => option.modName ?? t("requirement_links_modal::unknown_mod"),
  );
  const fileLines = requirement.options
    .map((option) => fileLine(option, t))
    .filter((line) => line !== undefined);

  return (
    <li className="flex items-start justify-between gap-4" data-testid="missing-requirement">
      <div className="min-w-0">
        <Typography typographyType="body-sm">
          {names.join(t("requirement_links_modal::or"))}
        </Typography>

        {fileLines.map((line) => (
          <Typography appearance="weak" as="div" key={line} typographyType="body-xs">
            {line}
          </Typography>
        ))}

        {requirement.notes !== undefined && <RequirementNote notes={requirement.notes} />}
      </div>

      <Typography
        appearance="moderate"
        brand="warning"
        className="shrink-0"
        typographyType="body-sm"
      >
        {t("requirement_links_modal::not_installed")}
      </Typography>
    </li>
  );
};
