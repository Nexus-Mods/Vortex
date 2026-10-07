import { mdiChevronDown, mdiChevronUp } from "@mdi/js";
import React, { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

interface IIssueSectionProps {
  actions?: ReactNode;
  children: ReactNode;
  count: number;
  description: string;
  testId?: string;
  title: string;
}

/** A collapsible card grouping one issue type's rows, with its bulk actions in the header. */
export const IssueSection = ({
  actions,
  children,
  count,
  description,
  testId,
  title,
}: IIssueSectionProps) => {
  const { t } = useTranslation("health_check");
  const [collapsed, setCollapsed] = useState(false);
  const contentId = useId();

  return (
    <section className="rounded-lg border border-stroke-weak p-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-x-4">
        <Typography appearance="moderate" className="flex items-center gap-x-2 font-semibold">
          <span>{title}</span>

          <span className="text-neutral-subdued">{count}</span>
        </Typography>

        <div className="flex shrink-0 items-center gap-x-2">
          {actions}

          {!!actions && <div className="h-6 w-px bg-stroke-weak" />}

          <Button
            appearance="subdued"
            aria-controls={contentId}
            aria-expanded={!collapsed}
            aria-label={t(collapsed ? "listing::section::expand" : "listing::section::collapse")}
            brand="neutral"
            hasExpandedStyle={false}
            leftIconPath={collapsed ? mdiChevronDown : mdiChevronUp}
            size="sm"
            onClick={() => setCollapsed((value) => !value)}
          />
        </div>
      </div>

      {!collapsed && (
        <Typography appearance="subdued" brand="neutral-translucent" typographyType="body-sm">
          {description}
        </Typography>
      )}

      <div className="mt-4 space-y-2" hidden={collapsed} id={contentId}>
        {children}
      </div>
    </section>
  );
};
