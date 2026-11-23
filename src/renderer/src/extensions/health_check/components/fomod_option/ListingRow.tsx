import React from "react";

import { Button } from "@/ui/components/button/Button";

import type { IFomodOptionIssue } from "../../checks/fomodOptionsCheck";
import { useIssue, useIssueTracking } from "../../hooks/HealthCheckTracking.context";
import type { IListingRowProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
import { ListingRow as ListingRowShell } from "../listing_row/ListingRow";

/**
 * One mod's newly available installer options, in the listing.
 *
 * The action is "Change options" rather than an install: the mod is already installed, and
 * what the user needs is its installer reopened with the option they missed.
 */
export const ListingRow = ({ entry, isHidden, onOpen, onToggleHide }: IListingRowProps) => {
  const issue = entry.data as IFomodOptionIssue;
  const { issueType, resolutionType } = useIssue();
  const { trackIssueHidden, trackIssueUnhidden } = useIssueTracking();

  const count = issue.options.length;
  const first = issue.options[0];

  const handleToggleHide = () => {
    if (isHidden) {
      trackIssueUnhidden({ issue_type: issueType });
    } else {
      trackIssueHidden({ issue_type: issueType, resolution_type: resolutionType });
    }
    onToggleHide();
  };

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
          Change options
        </Button>
      }
      detail={
        count === 1
          ? `${first.groupName}: ${first.optionName}`
          : `${count} options in ${issue.modName}`
      }
      entryActions={
        <EntryActions
          givenFeedback={false}
          isHidden={isHidden}
          variant="listing"
          onHelpful={() => undefined}
          onNotHelpful={() => undefined}
          onToggleHide={handleToggleHide}
        />
      }
      severity={entry.severity}
      summary={
        count === 1
          ? `Available now that ${first.reason} is active`
          : "Options that were unavailable when this mod was installed are available now"
      }
      title={issue.modName}
      onOpen={onOpen}
    />
  );
};
