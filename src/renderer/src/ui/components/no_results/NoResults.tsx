import React, { type PropsWithChildren } from "react";

import { Button } from "@/ui/components/button/Button";
import { Icon, type IIconSource } from "@/ui/components/icon/Icon";
import { getIconProps } from "@/ui/components/icon/utils/icon_props/iconProps.util";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

type IAppearance = "default" | "success";

const getIconClassName = (appearance: IAppearance) => {
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
  icon,
  iconClassName,
  isError,
  message,
  title,
}: PropsWithChildren<{
  appearance?: IAppearance;
  className?: string;
  icon?: IIconSource;
  iconClassName?: string;
  isError?: boolean;
  message?: string;
  title: string;
}>) => (
  <div className={joinClasses(["mx-auto flex max-w-md flex-col items-center gap-y-4", className])}>
    <div className="flex flex-col items-center gap-y-2">
      {(!!icon || isError) && (
        <Icon
          {...getIconProps(icon ?? "error")}
          className={iconClassName ?? getIconClassName(appearance)}
          size="xl"
        />
      )}

      <Typography appearance="subdued" as="div" className="space-y-2 text-center">
        {(!!title || isError) && <p className="font-semibold">{title ?? "Something went wrong"}</p>}

        {(!!message || isError) && (
          <p>{message ?? "If the issue persists, please contact our support team."}</p>
        )}
      </Typography>
    </div>

    {children
      ? children
      : isError && (
          <Button
            appearance="moderate"
            brand="neutral"
            leftIcon="open_in_new"
            onClick={() =>
              window.api.shell.openUrl("https://help.nexusmods.com/article/125-contact-us")
            }
          >
            Contact support
          </Button>
        )}
  </div>
);
