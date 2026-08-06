import { mdiTune } from "@mdi/js";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";

import { DisplayOptionsItem } from "./DisplayOptionsItem";

/**
 * The tune-icon popover a listing puts in its page header, holding the controls
 * for how that listing is shown. Compose the rows from `DisplayOptionsItem`.
 *
 * Every panel ends in a reset link, so there is always a way back to the
 * defaults; `onReset` restores them and the panel closes itself.
 *
 * The trigger and reset labels default to "Display options" and "Reset to
 * default"; pass them only to say something else.
 */
export const DisplayOptions = ({
  children,
  label,
  resetLabel,
  onReset,
}: {
  children: ReactNode;
  label?: string;
  resetLabel?: string;
  onReset: () => void;
}) => {
  const { t } = useTranslation();
  const triggerLabel = label ?? t("Display options");

  return (
    <Popover>
      <Tooltip content={triggerLabel} placement="bottom">
        <PopoverButton
          appearance="weak"
          aria-label={triggerLabel}
          brand="neutral"
          leftIconPath={mdiTune}
          size="sm"
        />
      </Tooltip>

      <PopoverPanel>
        {({ close }) => (
          <>
            {children}

            <DisplayOptionsItem className="justify-end">
              <TypographyLink
                brand="info"
                typographyType="body-sm"
                variant="secondary"
                onClick={() => {
                  onReset();
                  close();
                }}
              >
                {resetLabel ?? t("Reset to default")}
              </TypographyLink>
            </DisplayOptionsItem>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
};
