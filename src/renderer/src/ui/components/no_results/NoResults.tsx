import React, { type PropsWithChildren, type ReactNode } from "react";

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
  footnote,
  icon,
  iconClassName,
  isError,
  message,
  onRetry,
  title,
}: PropsWithChildren<{
  /** The icon's colour: subdued by default, or success. */
  appearance?: IAppearance;
  /** Classes for the container, such as its padding. */
  className?: string;
  /** A note under the actions, by an info icon, in small text. */
  footnote?: ReactNode;
  /** The icon over the title; an error shows one without it. */
  icon?: IIconSource;
  /** Classes for the icon, in place of the appearance's colour. */
  iconClassName?: string;
  /** Whether it failed: an error icon and message, with Try again and Contact support. */
  isError?: boolean;
  /** What to say under the title. */
  message?: string;
  /** Asks again for what failed; offers Try again for an error when given. */
  onRetry?: () => void;
  /** What it's about, in bold. */
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
          <div className="flex flex-wrap justify-center gap-2">
            {!!onRetry && (
              <Button appearance="moderate" brand="neutral" leftIcon="refresh" onClick={onRetry}>
                Try again
              </Button>
            )}

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
          </div>
        )}

    {!!footnote && (
      <Typography appearance="subdued" as="div" className="text-center" typographyType="body-sm">
        <Icon
          className="relative top-px mr-2 align-text-bottom text-neutral-subdued"
          name="info"
          size="sm"
        />
        {footnote}
      </Typography>
    )}
  </div>
);
