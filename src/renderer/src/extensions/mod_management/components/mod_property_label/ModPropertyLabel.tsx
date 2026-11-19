import React, { type ReactNode } from "react";

import { Typography } from "@/ui/components/typography/Typography";

interface IModPropertyLabelProps {
  /** What it is, above it. */
  label: string;
  testId: string;
  children: ReactNode;
}

/**
 * A property's value under its label, as the Properties panel lays a read-only one out: the label
 * in the design's body/SM normal, over the value.
 */
export const ModPropertyLabel = ({ label, testId, children }: IModPropertyLabelProps) => (
  <dl className="flex min-w-0 flex-col" data-testid={testId}>
    {/* Normal set outright: the legacy styles make a <dt> bold. */}
    <dt className="font-normal">
      <Typography appearance="subdued" as="span" className="block" typographyType="body-sm">
        {label}
      </Typography>
    </dt>

    <dd className="flex min-w-0 items-center gap-x-1">{children}</dd>
  </dl>
);
