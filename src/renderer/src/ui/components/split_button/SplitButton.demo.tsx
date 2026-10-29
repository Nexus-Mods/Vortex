/**
 * SplitButton Demo Component
 * Demonstrates the SplitButton component's forms, brands, appearances and sizes
 */

import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import React from "react";

import type { IButtonAppearance, IButtonBrand } from "@/ui/components/button/Button";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Typography } from "@/ui/components/typography/Typography";

import { SplitButton, SplitButtonAction } from "./SplitButton";

const BRANDS: IButtonBrand[] = ["primary", "info", "neutral", "success", "danger", "premium"];
const APPEARANCES: IButtonAppearance[] = ["strong", "moderate", "subdued", "weak"];

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const remove = <SplitButtonAction icon="close" label="Remove" onClick={() => undefined} />;

const menuActions: IMenuAction[][] = [
  [
    { label: "Rename", icon: "edit", onClick: () => undefined },
    { label: "Duplicate", icon: "content_copy", onClick: () => undefined },
  ],
  [{ label: "Delete", icon: "delete", brand: "danger", onClick: () => undefined }],
];

/** A menu, built outside the split button around its `SplitButtonAction`. */
const menu = (
  <Popover className="flex">
    <HeadlessPopoverButton as={SplitButtonAction} icon="keyboard_arrow_down" label="More options" />

    <PopoverPanel anchor={{ gap: 4, to: "bottom end" }} className="nxm-popover-panel-dropdown">
      {({ close }) => <PopoverMenu actions={menuActions} label="More options" onSelect={close} />}
    </PopoverPanel>
  </Popover>
);

export const SplitButtonDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Split button
      </Typography>

      <Typography appearance="subdued">
        A button with a second part beside it: an action of its own, or a chevron opening a menu.
        Each part hovers, presses and takes focus on its own. A main part without a click handler is
        static, not a button, though it isn't drawn as off.
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Forms
      </Typography>

      <div className="flex flex-wrap items-center gap-4">
        <SplitButton appearance="subdued" action={remove} brand="neutral" leftIcon="calendar_today">
          +2 more filter
        </SplitButton>

        <SplitButton
          appearance="subdued"
          action={remove}
          brand="neutral"
          leftIcon="calendar_today"
          onClick={() => undefined}
        >
          Clickable main part
        </SplitButton>

        <SplitButton action={menu} onClick={() => undefined}>
          With a menu
        </SplitButton>

        <SplitButton
          appearance="moderate"
          aria-label="Settings"
          brand="neutral"
          leftIcon="settings"
          action={menu}
          onClick={() => undefined}
        />

        <SplitButton isDisabled action={remove} onClick={() => undefined}>
          Disabled
        </SplitButton>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Brand × Appearance
      </Typography>

      {BRANDS.map((brand) => (
        <div className="space-y-2" key={brand}>
          <Typography appearance="subdued" typographyType="body-sm">
            {titleCase(brand)}
          </Typography>

          <div className="flex flex-wrap items-center gap-4">
            {APPEARANCES.map((appearance) => (
              <React.Fragment key={appearance}>
                <SplitButton
                  action={remove}
                  appearance={appearance}
                  brand={brand}
                  onClick={() => undefined}
                >
                  {titleCase(appearance)}
                </SplitButton>

                <SplitButton
                  appearance={appearance}
                  brand={brand}
                  action={menu}
                  rightIcon="arrow_forward"
                  onClick={() => undefined}
                >
                  Menu
                </SplitButton>
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Sizes
      </Typography>

      <div className="flex flex-wrap items-center gap-4">
        <SplitButton action={remove} size="md" onClick={() => undefined}>
          Medium
        </SplitButton>

        <SplitButton action={remove} size="sm" onClick={() => undefined}>
          Small
        </SplitButton>

        <SplitButton action={menu} size="sm" onClick={() => undefined}>
          Small menu
        </SplitButton>
      </div>
    </div>
  </div>
);
