import { mdiTune, mdiViewGrid, mdiViewList } from "@mdi/js";
import type { TFunction } from "i18next";
import React, { type ReactNode } from "react";

import { Switch } from "@/ui/components/form/switch/Switch";
import { Picker } from "@/ui/components/picker/Picker";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { joinClasses } from "@/ui/utils/joinClasses";

const PopoverItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={joinClasses([
      "flex min-h-12 items-center gap-x-6 px-4 not-last:border-b not-last:border-stroke-weak",
      className,
    ])}
  >
    {children}
  </div>
);

interface IDisplayOptionsProps {
  t: TFunction;
  pickerLayout: "list" | "small" | "large";
  showHidden: boolean;
  onSetPickerLayout: (layout: "list" | "small" | "large") => void;
  onToggleHidden: () => void;
  onReset: () => void;
}

export const DisplayOptions = ({
  t,
  pickerLayout,
  showHidden,
  onSetPickerLayout,
  onToggleHidden,
  onReset,
}: IDisplayOptionsProps) => (
  <Popover>
    <PopoverButton appearance="subdued" brand="neutral" leftIconPath={mdiTune} size="sm" />

    <PopoverPanel>
      {({ close }) => (
        <>
          <PopoverItem className="justify-between gap-x-6">
            <Typography appearance="subdued" typographyType="body-sm">
              {t("Display as")}
            </Typography>

            <Picker<"list" | "small" | "large">
              button={{
                leftIconPath: pickerLayout === "list" ? mdiViewList : mdiViewGrid,
                size: "xs",
              }}
              options={[
                { label: t("Grid"), value: "small", iconPath: mdiViewGrid },
                { label: t("List"), value: "list", iconPath: mdiViewList },
              ]}
              value={pickerLayout}
              onChange={onSetPickerLayout}
            />
          </PopoverItem>

          <PopoverItem className="justify-between gap-x-6">
            <Typography appearance="subdued" typographyType="body-sm">
              {t("Show hidden items")}
            </Typography>

            <Switch checked={showHidden} onChange={onToggleHidden} />
          </PopoverItem>

          <PopoverItem className="justify-end">
            <TypographyLink
              brand="info"
              typographyType="body-sm"
              variant="secondary"
              onClick={() => {
                onReset();
                close();
              }}
            >
              {t("Reset to default")}
            </TypographyLink>
          </PopoverItem>
        </>
      )}
    </PopoverPanel>
  </Popover>
);
