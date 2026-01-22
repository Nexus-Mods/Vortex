import React from "react";
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
  className,
  iconPath,
  message,
  title,
}: {
  appearance?: Appearance;
  className?: string;
  iconPath?: string;
  message?: string;
  title: string;
}) => (
  <div
    className={joinClasses(["flex items-center flex-col gap-y-2", className])}
  >
    {!!iconPath && (
      <Icon
        className={getIconClassName(appearance)}
        path={iconPath}
        size="xl"
      />
    )}

    <Typography as="div" appearance="subdued" className="text-center space-y-2">
      <p className="font-semibold">{title}</p>

      {!!message && <p>{message}</p>}
    </Typography>
  </div>
);
