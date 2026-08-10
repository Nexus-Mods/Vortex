import React, { type ReactNode } from "react";

import { Typography } from "@/ui/components/typography/Typography";

export const RequirementGroup = ({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div className="mx-6">
    <div className="flex h-10 items-center justify-between rounded-t-lg bg-surface-mid px-6">
      <Typography brand="neutral-translucent" className="font-semibold">
        {title}
      </Typography>

      {actions}
    </div>

    <div className="rounded-b-lg border-x border-b border-surface-mid py-6">{children}</div>
  </div>
);
