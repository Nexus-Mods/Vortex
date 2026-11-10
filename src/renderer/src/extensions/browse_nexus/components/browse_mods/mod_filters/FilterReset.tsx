import React from "react";

import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";

interface IFilterResetProps {
  /** What it says. */
  label: string;
  /** Puts the filters it's for back. */
  onReset: () => void;
}

/** A link at the foot of a filters menu that puts its filters back as the view has them. */
export const FilterReset = ({ label, onReset }: IFilterResetProps) => (
  <>
    <DropdownDivider className="mt-1" />

    <PopoverPanelGroupItem className="h-auto justify-end py-3">
      <TypographyLink brand="info" typographyType="body-sm" variant="secondary" onClick={onReset}>
        {label}
      </TypographyLink>
    </PopoverPanelGroupItem>
  </>
);
