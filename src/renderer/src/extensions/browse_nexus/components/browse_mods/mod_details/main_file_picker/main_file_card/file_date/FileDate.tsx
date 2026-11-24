import React from "react";
import { useTranslation } from "react-i18next";

import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import type { TFunction } from "@/util/i18n";
import { useRelativeTime } from "@/util/useRelativeTime";

/** What a file's date is of. */
export type FileDateKind = "uploaded" | "installed" | "downloaded";

/** A date said as how long ago it was, after what it's of. */
const fileDateText = (t: TFunction, kind: FileDateKind, time: string) => {
  if (kind === "installed") {
    return t("Installed {{time}}", { time });
  }

  if (kind === "downloaded") {
    return t("Downloaded {{time}}", { time });
  }

  return t("Uploaded {{time}}", { time });
};

interface IFileDateProps {
  /** What it's the date of. */
  kind: FileDateKind;
  /** When, in ms. */
  timestamp: number;
  /** Which file it's of, for its test id. */
  fileId: number;
}

/** A file's date, how long ago, with the exact date on hover; its own component as it ages. */
export const FileDate = ({ kind, timestamp, fileId }: IFileDateProps) => {
  const { t, i18n } = useTranslation();
  const ago = useRelativeTime(timestamp, t) ?? "";
  const exact = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);

  return (
    <Tooltip content={exact}>
      <span data-testid={`main-file-card-${kind}-${fileId}`}>
        <Typography appearance="subdued" as="span" typographyType="body-sm">
          {fileDateText(t, kind, ago)}
        </Typography>
      </span>
    </Tooltip>
  );
};
