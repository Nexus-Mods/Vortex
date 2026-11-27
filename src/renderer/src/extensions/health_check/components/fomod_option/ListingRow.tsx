import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";

import type { IFomodOptionIssue } from "../../checks/fomodOptionsCheck";
import type { IListingRowProps } from "../../views/content/types";
import { ListingRow as ListingRowShell } from "../listing_row/ListingRow";

/**
 * One mod's newly available installer options, in the listing.
 *
 * The action is "Change options" rather than an install: the mod is already installed, and
 * what the user needs is its installer reopened with the option they missed.
 *
 * No entry actions: this check has no hide store and no feedback store of its own, so the
 * shared hide and thumbs controls would render without doing anything.
 */
export const ListingRow = ({ entry, onOpen }: IListingRowProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const issue = entry.data as IFomodOptionIssue;

  const count = issue.options.length;
  const first = issue.options[0];

  return (
    <ListingRowShell
      action={
        <Button
          appearance="moderate"
          brand="neutral"
          leftIcon="tune"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {t("listing::fomod_options::change_options")}
        </Button>
      }
      detail={
        count === 1
          ? t("listing::fomod_options::detail_one", {
              groupName: first.groupName,
              optionName: first.optionName,
            })
          : t("listing::fomod_options::detail_many", { count, modName: issue.modName })
      }
      severity={entry.severity}
      summary={
        count === 1
          ? t("listing::fomod_options::summary_one", { reason: first.reason })
          : t("listing::fomod_options::summary_many")
      }
      title={issue.modName}
      onOpen={onOpen}
    />
  );
};
