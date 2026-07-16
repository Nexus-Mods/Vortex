import React, { type ReactNode } from "react";

import { Typography } from "@/ui/components/typography/Typography";

export const RequirementGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mx-6">
    <Typography
      brand="neutral-translucent"
      className="flex h-10 items-center rounded-t-lg bg-surface-mid px-6 font-semibold"
    >
      {title}
    </Typography>

    <div className="rounded-b-lg border-x border-b border-surface-mid py-6">{children}</div>
  </div>
);
