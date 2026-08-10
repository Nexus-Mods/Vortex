import { mdiChevronRight } from "@mdi/js";
import React, { type KeyboardEvent, type ReactNode } from "react";

import {
  type Severity,
  severityStyleMap,
} from "@/extensions/health_check/utils/shared/severityStyles";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface IListingRowProps {
  severity: Severity;
  title: ReactNode;
  summary: ReactNode;
  detail: ReactNode;
  entryActions: ReactNode;
  action?: ReactNode;
  onOpen: () => void;
}

export const ListingRow = ({
  severity,
  title,
  summary,
  detail,
  entryActions,
  action,
  onOpen,
}: IListingRowProps) => {
  const severityStyle = severityStyleMap[severity];

  return (
    <div
      className="group hover-overlay-weak flex w-full cursor-pointer items-start gap-x-4 rounded-sm bg-surface-mid px-4 py-3 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info-subdued"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e: KeyboardEvent) => {
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
        <div className="flex items-start justify-between gap-x-4">
          <div className="min-w-0">
            <Typography brand="neutral-translucent" className="truncate">
              {title}
            </Typography>

            <Typography appearance="subdued" className="truncate" typographyType="body-sm">
              {summary}
            </Typography>

            <Typography appearance="subdued" className="truncate" typographyType="body-sm">
              {detail}
            </Typography>
          </div>

          {entryActions}
        </div>
      </div>

      {action}

      <Icon className="shrink-0 text-translucent-moderate" path={mdiChevronRight} size="lg" />
    </div>
  );
};
