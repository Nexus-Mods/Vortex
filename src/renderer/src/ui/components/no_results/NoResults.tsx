import React, { type PropsWithChildren } from "react";

import { Button } from "@/ui/components/button/Button";
import { Icon, type ISymbolSource, symbolProps } from "@/ui/components/icon/Icon";
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
  iconClassName,
  iconPath,
  isError,
  message,
  symbol,
  title,
}: PropsWithChildren<{
  appearance?: IAppearance;
  className?: string;
  iconClassName?: string;
  iconPath?: string;
  isError?: boolean;
  message?: string;
  symbol?: ISymbolSource;
  title: string;
}>) => (
  <div className={joinClasses(["mx-auto flex max-w-md flex-col items-center gap-y-4", className])}>
    <div className="flex flex-col items-center gap-y-2">
      {(!!iconPath || !!symbol || isError) && (
        <Icon
          {...(iconPath && !symbol ? { path: iconPath } : symbolProps(symbol ?? "error"))}
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
            leftSymbol="open_in_new"
            onClick={() =>
              window.api.shell.openUrl("https://help.nexusmods.com/article/125-contact-us")
            }
          >
            Contact support
          </Button>
        )}
  </div>
);
