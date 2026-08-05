import React, { type PropsWithChildren } from "react";

import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

/**
 * One row of a `DisplayOptions` panel: a label on the left and its control on
 * the right. Rows are separated by a rule, except the last one. Leave `label`
 * off for a row that is only a control (the reset link uses that).
 */
export const DisplayOptionsItem = ({
  children,
  className,
  label,
}: PropsWithChildren<{ className?: string; label?: string }>) => (
  <div
    className={joinClasses(
      [
        "flex min-h-12 items-center gap-x-6 px-4 not-last:border-b not-last:border-stroke-weak",
        className,
      ],
      { "justify-between": !!label },
    )}
  >
    {!!label && (
      <Typography appearance="subdued" typographyType="body-sm">
        {label}
      </Typography>
    )}

    {children}
  </div>
);
