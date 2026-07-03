import React, { type FC } from "react";

import { Typography } from "../../../ui/components/typography/Typography";
import { getApplication } from "../../../util/application";

export const VersionIndicator: FC = () => {
  const version = getApplication().version;
  const formattedVersion = `v${version}`;

  return (
    <Typography
      appearance="weak"
      brand="neutral-translucent"
      className="text-translucent-weaker!"
      data-testid="version-indicator"
      typographyType="body-sm"
    >
      {formattedVersion}
    </Typography>
  );
};
