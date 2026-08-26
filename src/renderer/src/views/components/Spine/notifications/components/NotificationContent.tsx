import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

interface NotificationContentProps {
  title?: string;
  lines: string[];
}

export const NotificationContent = ({ title, lines }: NotificationContentProps) => {
  return (
    <Typography appearance="moderate" as="div" typographyType="body-sm">
      {!!title && <p className="font-semibold">{title}</p>}

      <div>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </Typography>
  );
};
