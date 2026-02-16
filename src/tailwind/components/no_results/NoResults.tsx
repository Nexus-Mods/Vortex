import { mdiAlertCircleOutline, mdiOpenInNew } from "@mdi/js";
import React, { type PropsWithChildren } from "react";

import opn from "../../../util/opn";
import { Button } from "../next/button";
import { Icon } from "../next/icon";
import { Typography } from "../next/typography";
import { joinClasses } from "../next/utils";

type Appearance = "default" | "success";

const getIconClassName = (appearance: Appearance) => {
  switch (appearance) {
    case "success":
      return "text-success-strong";
    default:
      return "text-neutral-subdued";
  }
};

export const NoResults = ({
  appearance = "default",
  children,
  className,
  iconPath,
  isError,
  message,
  title,
}: PropsWithChildren<{
  appearance?: Appearance;
  className?: string;
  iconPath?: string;
  isError?: boolean;
  message?: string;
  title: string;
}>) => (
  <div
    className={joinClasses([
      "mx-auto flex max-w-lg flex-col items-center gap-y-4",
      className,
    ])}
  >
    <div className="flex flex-col items-center gap-y-2">
      {(!!iconPath || isError) && (
        <Icon
          className={getIconClassName(appearance)}
          path={iconPath ?? mdiAlertCircleOutline}
          size="xl"
        />
      )}

      <Typography
        appearance="subdued"
        as="div"
        className="space-y-2 text-center"
      >
        {(!!title || isError) && (
          <p className="font-semibold">{title ?? "Something went wrong"}</p>
        )}

        {(!!message || isError) && (
          <p>
            {message ??
              "If the issue persists, please contact our support team."}
          </p>
        )}
      </Typography>
    </div>

    {children
      ? children
      : isError && (
          <Button
            buttonType="tertiary"
            filled="weak"
            leftIconPath={mdiOpenInNew}
            size="sm"
            onClick={() => {
              opn("https://help.nexusmods.com/article/125-contact-us").catch(
                () => undefined,
              );
            }}
          >
            Contact support
          </Button>
        )}
  </div>
);
