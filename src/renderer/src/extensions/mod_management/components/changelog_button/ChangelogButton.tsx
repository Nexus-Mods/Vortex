import { mdiFileDocumentOutline } from "@mdi/js";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";
import { Typography } from "@/ui/components/typography/Typography";

interface IChangelogButtonProps {
  /** Which version or revision the changelog is for, heading it. */
  title: string;
  /** The changelog, as `Markdown` or `Html` renders it. */
  children: ReactNode;
}

/** A Version cell's button that opens a changelog in a popover, which scrolls past its height. */
export const ChangelogButton = ({ title, children }: IChangelogButtonProps) => {
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
            <Typography as="div" className="font-semibold">
              {title}
            </Typography>

            {children}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
};
