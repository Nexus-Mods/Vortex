import React, { type ReactNode } from "react";

import { Typography } from "@/ui/components/typography/Typography";

/** A titled group of fields on the form demos, on a grid of three even columns. */
export const FormDemoSection = ({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <Typography as="h4" typographyType="heading-xs">
        {title}
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        {description}
      </Typography>
    </div>

    <div className="grid grid-cols-[repeat(3,15rem)] items-start gap-x-6 gap-y-6">{children}</div>
  </div>
);
