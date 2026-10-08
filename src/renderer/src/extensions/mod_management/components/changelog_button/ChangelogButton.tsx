import { mdiFileDocumentOutline } from "@mdi/js";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import { Typography } from "@/ui/components/typography/Typography";

interface IChangelogButtonProps {
  /** The newest version's or revision's changelog, as `Markdown` or `Html` renders it at `sm`. */
  children: ReactNode;
}

/** A Version cell's button that opens a changelog in a popover, which scrolls past its height. */
export const ChangelogButton = ({ children }: IChangelogButtonProps) => {
  const { t } = useTranslation(["common"]);

  return (
    <Popover>
      {({ open }) => (
        <>
          <ToolbarButton
            appearance="moderate"
            as={PopoverButton}
            brand="info"
            label={t("View changelog")}
            leftIconPath={mdiFileDocumentOutline}
            size="sm"
            tooltipDisabled={open}
          />

          {/* Its height through the anchor's own limit, which a max-height would lose to. */}
          <PopoverPanel className="flex w-96 flex-col gap-y-2 overflow-y-auto p-4 [--anchor-max-height:calc(var(--spacing)*96)]">
            <div>
              <Typography as="div" className="font-semibold" typographyType="body-sm">
                {t("Changelog")}
              </Typography>

              <Typography appearance="subdued" as="div" typographyType="body-sm">
                {t("Newest Version")}
              </Typography>
            </div>

            {children}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
};
