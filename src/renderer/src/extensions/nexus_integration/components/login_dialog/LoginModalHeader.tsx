import React from "react";

import { Pictogram } from "@/ui/components/pictogram/Pictogram";
import { Typography } from "@/ui/components/typography/Typography";

/** The account pictogram, title and description every login modal opens with. */
export const LoginModalHeader = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center gap-y-6">
    <Pictogram name="account" size="xs" />

    <div className="space-y-1">
      <Typography as="h2" typographyType="heading-xs">
        {title}
      </Typography>

      <Typography appearance="moderate" typographyType="body-md">
        {description}
      </Typography>
    </div>
  </div>
);
